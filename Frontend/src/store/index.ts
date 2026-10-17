import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  AuthSession, Persona, WorkspaceId, TaskId, Task, Comment, ProjectFile, TimeEntry,
  Invite, Project, ClientOrg, WorkspaceMember, ActivityEntry, User, Workspace,
} from '@/types';
import * as authApi from '@/api/auth';
import * as projectsApi from '@/api/projects';
import * as tasksApi from '@/api/tasks';
import * as commentsApi from '@/api/comments';
import * as filesApi from '@/api/files';
import * as timeApi from '@/api/time';
import * as teamApi from '@/api/team';
import * as invitesApi from '@/api/invites';
import * as clientsApi from '@/api/clients';
import * as dashboardApi from '@/api/dashboard';
import { ApiError } from '@/api/client';
import {
  mapActivity, mapClient, mapComment, mapFile, mapInvite, mapMembership, mapProject,
  mapProjectMember, mapSession, mapTask, mapTimeEntry, mapUser, mapWorkspace,
} from '@/api/mappers';
import type { ApiRole, WorkspaceChoice } from '@/api/types';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'success' | 'error';
}

export interface LoadState<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

const STORAGE_KEY = 'agencydesk.session';
const emptyLoad = <T>(data: T): LoadState<T> => ({ data, loading: false, error: null });

function messageForError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 0) return "Can't reach server";
    if (error.status === 403) return "You don't have permission";
    if (error.status === 413) return error.message;
    if (error.status === 400 || error.status === 409) return error.message;
    return error.message;
  }
  return error instanceof Error ? error.message : 'Request failed';
}

interface AppState {
  session: AuthSession | null;
  identityToken: string | null;
  workspaces: WorkspaceChoice[];
  authLoading: boolean;
  authReady: boolean;
  persona: Persona;
  viewingAs: Persona;
  projects: Project[];
  tasks: Task[];
  comments: Comment[];
  files: ProjectFile[];
  timeEntries: TimeEntry[];
  invites: Invite[];
  clients: ClientOrg[];
  members: WorkspaceMember[];
  users: User[];
  activity: ActivityEntry[];
  projectState: LoadState<Project[]>;
  taskState: LoadState<Task[]>;
  commentState: LoadState<Comment[]>;
  fileState: LoadState<ProjectFile[]>;
  timeState: LoadState<TimeEntry[]>;
  inviteState: LoadState<Invite[]>;
  clientState: LoadState<ClientOrg[]>;
  teamState: LoadState<WorkspaceMember[]>;
  activityState: LoadState<ActivityEntry[]>;
  taskDetailState: LoadState<Task | null>;
  dashboard: LoadState<Awaited<ReturnType<typeof dashboardApi.getDashboard>> | null>;
  hours: LoadState<Awaited<ReturnType<typeof timeApi.getProjectHours>> | null>;
  sidebarCollapsed: boolean;
  toasts: Toast[];
  commandPaletteOpen: boolean;
  taskDrawerId: TaskId | null;

  login(email: string, password: string, portal: boolean): Promise<void>;
  selectWorkspace(membershipId: string): Promise<void>;
  restoreSession(): Promise<void>;
  updateProfile(fullName: string): Promise<void>;
  updateAgency(agencyName: string): Promise<void>;
  logout(): void;
  switchWorkspace(workspaceId: WorkspaceId): Promise<void>;
  setViewingAs(persona: Persona): void;
  loadProjects(): Promise<void>;
  loadProject(projectId: string): Promise<Project | null>;
  loadTasks(projectId: string, filters?: tasksApi.TaskQuery): Promise<void>;
  loadTaskDetail(taskId: string): Promise<void>;
  loadProjectFiles(projectId: string): Promise<void>;
  loadProjectTime(projectId: string): Promise<void>;
  loadTeam(): Promise<void>;
  loadClients(): Promise<void>;
  loadInvites(): Promise<void>;
  loadDashboard(): Promise<void>;
  loadHours(projectId: string): Promise<void>;
  loadActivity(): Promise<void>;
  createTask(task: Task): Promise<Task>;
  updateTask(id: TaskId, patch: Partial<Task>): Promise<Task>;
  moveTask(id: TaskId, status: Task['status']): Promise<void>;
  removeTaskAssignee(userId: string): void;
  addComment(comment: Comment): Promise<Comment>;
  uploadTaskFile(taskId: string, file: File, visibility: ProjectFile['visibility'], progress?: (percent: number) => void): Promise<ProjectFile>;
  updateFileReview(id: string, status: ProjectFile['reviewStatus'], note: string | null): Promise<void>;
  addTimeEntry(entry: TimeEntry): Promise<TimeEntry>;
  addInvite(invite: Invite): Promise<{ invite: Invite; token: string }>;
  resendInvite(id: string): Promise<string>;
  revokeInvite(id: string): Promise<void>;
  removeMember(membershipId: string): Promise<void>;
  addProject(project: Project): Promise<Project>;
  setSidebarCollapsed(v: boolean): void;
  pushToast(toast: Omit<Toast, 'id'>): void;
  dismissToast(id: string): void;
  setCommandPaletteOpen(v: boolean): void;
  setTaskDrawerId(id: TaskId | null): void;
}

const clearData = (state: AppState) => {
  state.projects = [];
  state.tasks = [];
  state.comments = [];
  state.files = [];
  state.timeEntries = [];
  state.invites = [];
  state.clients = [];
  state.members = [];
  state.users = [];
  state.activity = [];
  state.projectState = emptyLoad([]);
  state.taskState = emptyLoad([]);
  state.commentState = emptyLoad([]);
  state.fileState = emptyLoad([]);
  state.timeState = emptyLoad([]);
  state.inviteState = emptyLoad([]);
  state.clientState = emptyLoad([]);
  state.teamState = emptyLoad([]);
  state.activityState = emptyLoad([]);
  state.taskDetailState = emptyLoad(null);
  state.dashboard = emptyLoad(null);
  state.hours = emptyLoad(null);
  state.taskDrawerId = null;
};

const upsert = <T extends { id: string }>(list: T[], value: T) => {
  const index = list.findIndex((item) => item.id === value.id);
  if (index < 0) list.push(value);
  else list[index] = value;
};

const upsertMember = (list: WorkspaceMember[], value: WorkspaceMember) => {
  const index = list.findIndex((member) => member.userId === value.userId);
  if (index < 0) list.push(value);
  else list[index] = value;
};

function toApiRole(role: Persona): ApiRole {
  return role === 'admin' ? 'agency_admin' : role === 'member' ? 'agency_member' : 'client_user';
}

function apiPatch(patch: Partial<Task>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (patch.title !== undefined) body.title = patch.title;
  if (patch.description !== undefined) body.description = patch.description;
  if (patch.status !== undefined) body.status = patch.status;
  if (patch.priority !== undefined) body.priority = patch.priority;
  if (patch.visibility !== undefined) body.visibility = patch.visibility === 'client' ? 'client_visible' : 'internal';
  if (patch.assigneeId !== undefined) body.assignee_id = patch.assigneeId;
  if (patch.dueDate !== undefined) body.due_date = patch.dueDate;
  return body;
}

export const useStore = create<AppState>()(immer((set, get) => ({
  session: null,
  identityToken: null,
  workspaces: [],
  authLoading: false,
  authReady: false,
  persona: 'member',
  viewingAs: 'member',
  projects: [],
  tasks: [],
  comments: [],
  files: [],
  timeEntries: [],
  invites: [],
  clients: [],
  members: [],
  users: [],
  activity: [],
  projectState: emptyLoad([]),
  taskState: emptyLoad([]),
  commentState: emptyLoad([]),
  fileState: emptyLoad([]),
  timeState: emptyLoad([]),
  inviteState: emptyLoad([]),
  clientState: emptyLoad([]),
  teamState: emptyLoad([]),
  activityState: emptyLoad([]),
  taskDetailState: emptyLoad(null),
  dashboard: emptyLoad(null),
  hours: emptyLoad(null),
  sidebarCollapsed: false,
  toasts: [],
  commandPaletteOpen: false,
  taskDrawerId: null,

  async login(email, password, portal) {
    set((state) => { state.authLoading = true; });
    try {
      const result = await authApi.login(email, password, portal);
      set((state) => {
        state.identityToken = result.identity_token;
        state.workspaces = result.workspaces;
        state.authLoading = false;
      });
    } catch (error) {
      set((state) => { state.authLoading = false; });
      throw error;
    }
  },

  async selectWorkspace(membershipId) {
    const identityToken = get().identityToken;
    if (!identityToken) throw new Error('Please sign in again to select a workspace');
    set((state) => {
      clearData(state);
      state.authLoading = true;
    });
    let selected: Awaited<ReturnType<typeof authApi.selectWorkspace>>;
    try {
      selected = await authApi.selectWorkspace(identityToken, membershipId);
    } catch (error) {
      set((state) => { state.authLoading = false; });
      throw error;
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      token: selected.access_token,
      identityToken,
      workspaces: get().workspaces,
    }));
    try {
      const me = await authApi.getMe();
      const session = mapSession(me, selected.access_token);
      set((state) => {
        state.session = session;
        state.persona = session.role;
        state.viewingAs = session.role;
        state.identityToken = identityToken;
        state.authLoading = false;
        state.authReady = true;
      });
    } catch (error) {
      sessionStorage.removeItem(STORAGE_KEY);
      set((state) => {
        clearData(state);
        state.session = null;
        state.authLoading = false;
      });
      throw error;
    }
  },

  async restoreSession() {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      set((state) => { state.authReady = true; });
      return;
    }
    try {
      const saved: { token: string; identityToken: string | null; workspaces?: WorkspaceChoice[] } = JSON.parse(raw);
      if (!saved.token) throw new Error('Session is invalid');
      set((state) => {
        state.authLoading = true;
        state.identityToken = saved.identityToken;
        state.workspaces = saved.workspaces ?? [];
      });
      const me = await authApi.getMe();
      const session = mapSession(me, saved.token);
      set((state) => {
        state.session = session;
        state.persona = session.role;
        state.viewingAs = session.role;
        state.authLoading = false;
        state.authReady = true;
      });
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
      set((state) => {
        clearData(state);
        state.session = null;
        state.authLoading = false;
        state.authReady = true;
      });
    }
  },

  async updateProfile(fullName) {
    const me = await authApi.updateProfile(fullName);
    const session = get().session;
    if (!session) throw new Error('Sign in again to update your profile');
    const user = mapUser(session.membershipId, me.email, me.full_name);
    set((state) => {
      if (!state.session) return;
      state.session.user = user;
      upsert(state.users, user);
    });
  },

  async updateAgency(agencyName) {
    const updated = await authApi.updateAgency(agencyName);
    set((state) => {
      if (state.session?.agencyId === updated.agency_id) state.session.agencyName = updated.agency_name;
      state.workspaces = state.workspaces.map((choice) => (
        choice.agency_id === updated.agency_id ? { ...choice, agency_name: updated.agency_name } : choice
      ));
    });
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const stored: unknown = JSON.parse(raw);
      if (typeof stored === 'object' && stored !== null && !Array.isArray(stored)) {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Object.assign({}, stored, { workspaces: get().workspaces })));
      }
    }
  },

  logout() {
    sessionStorage.removeItem(STORAGE_KEY);
    set((state) => {
      clearData(state);
      state.session = null;
      state.identityToken = null;
      state.workspaces = [];
      state.persona = 'member';
      state.viewingAs = 'member';
      state.authReady = true;
    });
  },

  async switchWorkspace(workspaceId) {
    const choice = get().workspaces.find((workspace) => workspace.agency_id === workspaceId);
    if (!choice) throw new Error('Workspace is not available. Sign in again.');
    await get().selectWorkspace(choice.membership_id);
  },

  setViewingAs(persona) {
    if (!import.meta.env.DEV) return;
    set((state) => { state.viewingAs = persona; });
  },

  async loadProjects() {
    set((state) => { state.projectState.loading = true; state.projectState.error = null; });
    try {
      const projects = (await projectsApi.listProjects()).map(mapProject);
      set((state) => {
        state.projects = projects;
        state.projectState = { data: projects, loading: false, error: null };
      });
    } catch (error) {
      const message = messageForError(error);
      set((state) => { state.projectState.loading = false; state.projectState.error = message; });
      throw error;
    }
  },

  async loadProject(projectId) {
    try {
      const apiProject = await projectsApi.getProject(projectId);
      const members = get().persona === 'client' ? [] : await projectsApi.getProjectMembers(projectId);
      const project = { ...mapProject(apiProject), memberIds: members.map((member) => member.membership_id) };
      set((state) => {
        upsert(state.projects, project);
        for (const member of members) {
          const mapped = mapProjectMember(member, apiProject.agency_id);
          upsertMember(state.members, mapped);
          if (mapped.user) upsert(state.users, mapped.user);
        }
      });
      return project;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },

  async loadTasks(projectId, filters) {
    set((state) => { state.taskState.loading = true; state.taskState.error = null; });
    try {
      const loaded = (await tasksApi.listTasks(projectId, filters)).map(mapTask);
      set((state) => {
        state.tasks = [...state.tasks.filter((task) => task.projectId !== projectId), ...loaded];
        state.taskState = { data: state.tasks, loading: false, error: null };
      });
    } catch (error) {
      set((state) => { state.taskState.loading = false; state.taskState.error = messageForError(error); });
      throw error;
    }
  },

  async loadTaskDetail(taskId) {
    set((state) => {
      state.taskDetailState.loading = true;
      state.taskDetailState.error = null;
      state.commentState.loading = true;
      state.commentState.error = null;
      state.fileState.loading = true;
      state.fileState.error = null;
      state.timeState.loading = true;
      state.timeState.error = null;
    });
    try {
      const [task, comments, files, times] = await Promise.all([
        tasksApi.getTask(taskId),
        commentsApi.listComments(taskId),
        filesApi.listFiles(taskId),
        get().persona === 'client' ? Promise.resolve([]) : timeApi.listTaskTime(taskId),
      ]);
      const mappedTask = mapTask(task);
      const projectId = mappedTask.projectId;
      const mappedComments = comments.map(mapComment);
      const mappedFiles = files.map((file) => ({ ...mapFile(file), workspaceId: mappedTask.workspaceId, projectId }));
      const mappedTimes = times.map((entry) => mapTimeEntry(entry, entry.project_id));
      set((state) => {
        upsert(state.tasks, mappedTask);
        state.comments = [...state.comments.filter((comment) => comment.taskId !== taskId), ...mappedComments];
        state.files = [...state.files.filter((file) => file.taskId !== taskId), ...mappedFiles];
        state.timeEntries = [...state.timeEntries.filter((entry) => entry.taskId !== taskId), ...mappedTimes];
        state.commentState = { data: state.comments, loading: false, error: null };
        state.fileState = { data: state.files, loading: false, error: null };
        state.timeState = { data: state.timeEntries, loading: false, error: null };
        state.taskDetailState = { data: mappedTask, loading: false, error: null };
      });
    } catch (error) {
      set((state) => {
        state.taskDetailState.loading = false;
        state.taskDetailState.error = messageForError(error);
        state.commentState.loading = false;
        state.commentState.error = messageForError(error);
        state.fileState.loading = false;
        state.fileState.error = messageForError(error);
        state.timeState.loading = false;
        state.timeState.error = messageForError(error);
      });
      throw error;
    }
  },

  async loadProjectFiles(projectId) {
    const projectTasks = get().tasks.filter((task) => task.projectId === projectId);
    set((state) => { state.fileState.loading = true; state.fileState.error = null; });
    try {
      const loaded = (await Promise.all(projectTasks.map((task) => filesApi.listFiles(task.id))))
        .flat()
        .map((file) => ({
          ...mapFile(file),
          workspaceId: get().session?.workspaceId ?? '',
          projectId,
        }));
      set((state) => {
        state.files = [...state.files.filter((file) => file.projectId !== projectId), ...loaded];
        state.fileState = { data: state.files, loading: false, error: null };
      });
    } catch (error) {
      set((state) => { state.fileState.loading = false; state.fileState.error = messageForError(error); });
      throw error;
    }
  },

  async loadProjectTime(projectId) {
    const projectTasks = get().tasks.filter((task) => task.projectId === projectId);
    set((state) => { state.timeState.loading = true; state.timeState.error = null; });
    try {
      const entries = (await Promise.all(projectTasks.map((task) => timeApi.listTaskTime(task.id))))
        .flat()
        .map((entry) => mapTimeEntry(entry, projectId));
      set((state) => {
        state.timeEntries = [...state.timeEntries.filter((entry) => entry.projectId !== projectId), ...entries];
        state.timeState = { data: state.timeEntries, loading: false, error: null };
      });
    } catch (error) {
      set((state) => { state.timeState.loading = false; state.timeState.error = messageForError(error); });
      throw error;
    }
  },

  async loadTeam() {
    set((state) => { state.teamState.loading = true; state.teamState.error = null; });
    try {
      const workspaceId = get().session?.workspaceId ?? '';
      const members = (await teamApi.listTeam()).map((member) => mapMembership(member, workspaceId));
      const users = members.flatMap((member) => member.user ? [member.user] : []);
      set((state) => {
        state.members = members;
        state.users = users;
        state.teamState = { data: members, loading: false, error: null };
      });
    } catch (error) {
      set((state) => { state.teamState.loading = false; state.teamState.error = messageForError(error); });
      throw error;
    }
  },

  async loadClients() {
    set((state) => { state.clientState.loading = true; state.clientState.error = null; });
    try {
      const clients = (await clientsApi.listClients()).map(mapClient);
      set((state) => {
        state.clients = clients;
        state.clientState = { data: clients, loading: false, error: null };
      });
    } catch (error) {
      set((state) => { state.clientState.loading = false; state.clientState.error = messageForError(error); });
      throw error;
    }
  },

  async loadInvites() {
    set((state) => { state.inviteState.loading = true; state.inviteState.error = null; });
    try {
      const invites = (await invitesApi.listInvites()).map(mapInvite);
      set((state) => {
        state.invites = invites;
        state.inviteState = { data: invites, loading: false, error: null };
      });
    } catch (error) {
      set((state) => { state.inviteState.loading = false; state.inviteState.error = messageForError(error); });
      throw error;
    }
  },

  async loadDashboard() {
    set((state) => { state.dashboard.loading = true; state.dashboard.error = null; });
    try {
      const data = await dashboardApi.getDashboard();
      set((state) => { state.dashboard = { data, loading: false, error: null }; });
    } catch (error) {
      set((state) => { state.dashboard.loading = false; state.dashboard.error = messageForError(error); });
      throw error;
    }
  },

  async loadHours(projectId) {
    set((state) => { state.hours.loading = true; state.hours.error = null; });
    try {
      const data = await timeApi.getProjectHours(projectId);
      set((state) => { state.hours = { data, loading: false, error: null }; });
    } catch (error) {
      set((state) => { state.hours.loading = false; state.hours.error = messageForError(error); });
      throw error;
    }
  },

  async loadActivity() {
    set((state) => { state.activityState.loading = true; state.activityState.error = null; });
    try {
      const workspaceId = get().session?.workspaceId ?? '';
      const activity = (await dashboardApi.getActivity()).map((entry) => mapActivity(entry, workspaceId));
      set((state) => {
        state.activity = activity;
        state.activityState = { data: activity, loading: false, error: null };
      });
    } catch (error) {
      set((state) => { state.activityState.loading = false; state.activityState.error = messageForError(error); });
      throw error;
    }
  },

  async createTask(task) {
    const result = await tasksApi.createTask(task.projectId, {
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      visibility: task.visibility === 'client' ? 'client_visible' : 'internal',
      assignee_id: task.assigneeId,
      due_date: task.dueDate,
    });
    const saved = mapTask(result);
    set((state) => {
    upsert(state.tasks, saved);
    state.taskState.data = state.tasks;
    });
    return saved;
  },

  async updateTask(id, patch) {
    const saved = mapTask(await tasksApi.patchTask(id, apiPatch(patch)));
    set((state) => {
      upsert(state.tasks, saved);
      state.taskState.data = state.tasks;
    });
    return saved;
  },

  async moveTask(id, status) {
    const previous = get().tasks.find((task) => task.id === id);
    if (!previous) return;
    set((state) => {
      const task = state.tasks.find((item) => item.id === id);
      if (task) task.status = status;
    });
    try {
      const saved = mapTask(await tasksApi.patchTask(id, { status }));
      set((state) => {
        upsert(state.tasks, saved);
        state.taskState.data = state.tasks;
      });
      get().pushToast({ title: `Task moved to ${status.replace('_', ' ')}`, variant: 'success' });
    } catch (error) {
      set((state) => {
        upsert(state.tasks, previous);
        state.taskState.data = state.tasks;
      });
      get().pushToast({ title: 'Task update failed', description: messageForError(error), variant: 'error' });
    }
  },

  removeTaskAssignee(userId) {
    set((state) => { state.tasks.forEach((task) => { if (task.assigneeId === userId) task.assigneeId = null; }); });
  },

  async addComment(comment) {
    const result = await commentsApi.createComment(
      comment.taskId,
      comment.body,
      comment.visibility === 'client' ? 'client_visible' : 'internal',
    );
    const saved = mapComment(result);
    set((state) => {
      upsert(state.comments, saved);
      state.commentState.data = state.comments;
    });
    return saved;
  },

  async uploadTaskFile(taskId, file, visibility, progress) {
    const result = await filesApi.uploadFile(taskId, file, visibility === 'client' ? 'client_visible' : 'internal', progress);
    const task = get().tasks.find((item) => item.id === taskId);
    const saved = {
      ...mapFile(result),
      workspaceId: task?.workspaceId ?? '',
      projectId: task?.projectId ?? '',
    };
    set((state) => {
      upsert(state.files, saved);
      state.fileState.data = state.files;
    });
    return saved;
  },

  async updateFileReview(id, status, note) {
    if (status === 'pending') throw new Error('A review must approve the file or request changes');
    const result = await filesApi.reviewFile(id, status, note);
    set((state) => {
      const file = state.files.find((item) => item.id === id);
      if (file) {
        file.reviewStatus = result.review_status;
        file.reviewNote = result.review_note;
      }
      state.fileState.data = state.files;
    });
  },

  async addTimeEntry(entry) {
    if (!entry.taskId) throw new Error('A task is required to log time');
    const result = await timeApi.logTime(entry.taskId, entry.minutes, entry.date, entry.note);
    const apiEntry = { ...result, project_id: entry.projectId };
    const saved = mapTimeEntry(apiEntry, entry.projectId);
    set((state) => {
      upsert(state.timeEntries, saved);
      state.timeState.data = state.timeEntries;
    });
    return saved;
  },

  async addInvite(invite) {
    const response = await invitesApi.createInvite(invite.email, toApiRole(invite.role), invite.clientOrgId ?? null);
    const saved: Invite = { ...invite, id: response.invite_id, createdAt: new Date().toISOString(), status: 'pending' };
    set((state) => {
      upsert(state.invites, saved);
      state.inviteState.data = state.invites;
    });
    return { invite: saved, token: response.token };
  },

  async resendInvite(id) {
    const response = await invitesApi.resendInvite(id);
    return response.token;
  },

  async revokeInvite(id) {
    await invitesApi.revokeInvite(id);
    set((state) => {
      state.invites = state.invites.map((invite) => invite.id === id ? { ...invite, status: 'revoked' } : invite);
      state.inviteState.data = state.invites;
    });
  },

  async removeMember(membershipId) {
    await teamApi.removeMember(membershipId);
    set((state) => { state.members = state.members.filter((member) => member.userId !== membershipId); });
    const projectIds = [...new Set(get().projects.map((project) => project.id))];
    await Promise.all(projectIds.map((projectId) => get().loadTasks(projectId)));
  },

  async addProject(project) {
    const saved = mapProject(await projectsApi.createProject({
      client_id: project.clientOrgId,
      name: project.name,
      description: project.description,
      start_date: project.startDate || null,
      due_date: project.dueDate || null,
    }));
    set((state) => {
      upsert(state.projects, saved);
      state.projectState.data = state.projects;
    });
    return saved;
  },

  setSidebarCollapsed(v) { set((state) => { state.sidebarCollapsed = v; }); },
  pushToast(toast) {
    const id = Math.random().toString(36).slice(2);
    set((state) => { state.toasts.push({ ...toast, id }); });
    setTimeout(() => get().dismissToast(id), 4000);
  },
  dismissToast(id) { set((state) => { state.toasts = state.toasts.filter((toast) => toast.id !== id); }); },
  setCommandPaletteOpen(v) { set((state) => { state.commandPaletteOpen = v; }); },
  setTaskDrawerId(id) { set((state) => { state.taskDrawerId = id; }); },
})));

export function useSession() {
  return useStore((state) => state.session);
}

export function useCurrentWorkspaceId(): WorkspaceId {
  return useStore((state) => state.session?.workspaceId ?? '');
}

export function useViewingAs(): Persona {
  return useStore((state) => state.persona);
}

export function useCurrentUserId(): string {
  return useStore((state) => state.session?.membershipId ?? '');
}

export function useClientOrgId(): string | undefined {
  return useStore((state) => state.session?.clientOrgId);
}

export function useCurrentUser(): User | undefined {
  return useStore((state) => state.session?.user);
}

export function useWorkspace(choice: WorkspaceChoice): Workspace {
  return mapWorkspace(choice);
}

export function useMembersForProject(projectId: string): WorkspaceMember[] {
  const members = useStore((state) => state.members);
  const project = useStore((state) => state.projects.find((item) => item.id === projectId));
  if (!project) return [];
  return members.filter((member) => project.memberIds.includes(member.userId));
}

export function useUserById(userId: string): User | undefined {
  return useStore((state) => state.users.find((user) => user.id === userId)
    ?? (state.session?.membershipId === userId ? state.session.user : undefined));
}
