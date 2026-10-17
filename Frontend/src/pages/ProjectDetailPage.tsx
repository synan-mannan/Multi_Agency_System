import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore, useViewingAs, useCurrentWorkspaceId } from '@/store';
import { projectAssignableMembers } from '@/lib/selectors';
import { Tabs, Badge, Skeleton, Button, Card, Avatar, Input, Label, Select, Textarea, Dialog, DialogContent, DialogHeader, DialogTitle, EmptyState } from '@/components/ui';
import { formatDateShort, isOverdue, priorityConfig, statusConfig, cn } from '@/lib/utils';
import { BoardView } from '@/features/projects/BoardView';
import { FilesTab } from '@/features/projects/FilesTab';
import { TimeTab } from '@/features/projects/TimeTab';
import {
  FolderKanban, List, Clock, FileText, BarChart2,
  CalendarDays, Plus, Lock, ArrowLeft,
} from 'lucide-react';
import type { Task, Priority, Visibility } from '@/types';

// ─── New Task Dialog ───────────────────────────────────────────────────────────

interface NewTaskDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  workspaceId: string;
}

export function NewTaskDialog({ open, onClose, projectId, workspaceId }: NewTaskDialogProps) {
  const createTask = useStore((s) => s.createTask);
  const pushToast = useStore((s) => s.pushToast);
  const projects = useStore((s) => s.projects);
  const members = useStore((s) => s.members);
  const assignable = projectAssignableMembers(workspaceId, projectId, projects, members);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('client');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const task: Task = {
      id: '',
      workspaceId,
      projectId,
      title,
      description,
      status: 'todo',
      priority,
      assigneeId: assigneeId || null,
      dueDate: dueDate || null,
      visibility,
      commentCount: 0,
      fileCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      await createTask(task);
      pushToast({ title: `Task "${title}" created`, variant: 'success' });
      setTitle(''); setDescription(''); setDueDate('');
      onClose();
    } catch (error) {
      pushToast({ title: 'Task could not be created', description: error instanceof Error ? error.message : 'Request failed', variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-zinc-900 ">New Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="task-title">Title</Label>
            <Input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title…" required className="mt-1" />
          </div>
          <div>
            <Label htmlFor="task-desc">Description</Label>
            <Textarea id="task-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description…" rows={3} className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="task-priority">Priority</Label>
              <Select
                id="task-priority"
                value={priority}
                onChange={(v) => setPriority(v as Priority)}
                options={(['urgent', 'high', 'medium', 'low'] as Priority[]).map((p) => ({ value: p, label: priorityConfig[p].label }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="task-assignee">Assignee</Label>
              <Select
                id="task-assignee"
                value={assigneeId}
                onChange={setAssigneeId}
                options={[{ value: '', label: 'Unassigned' }, ...assignable.map((m) => {
                  return { value: m.userId, label: m.user?.name ?? m.userId };
                })]}
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="task-due">Due Date</Label>
            <Input id="task-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Visibility</Label>
            <div className="flex gap-2 mt-1">
              {(['client', 'internal'] as Visibility[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVisibility(v)}
                  className={cn(
                    'flex-1 py-2 px-3 rounded-lg text-sm border transition-colors',
                    visibility === v
                      ? 'border-indigo-500 bg-indigo-50  text-indigo-700 '
                      : 'border-zinc-200  text-zinc-600 hover:border-zinc-300',
                  )}
                >
                  {v === 'client' ? '👁 Client-visible' : ' Internal only'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" className="flex-1" loading={loading}>Create Task</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── List View ─────────────────────────────────────────────────────────────────

function ListView({ projectId }: { projectId: string }) {
  const viewingAs = useViewingAs();
  const workspaceId = useCurrentWorkspaceId();
  const setTaskDrawerId = useStore((s) => s.setTaskDrawerId);
  const allTasks = useStore((s) => s.tasks);
  const users = useStore((s) => s.users);
  const tasks = allTasks.filter((task) => task.projectId === projectId && task.workspaceId === workspaceId);
  const [sortKey, setSortKey] = useState<'priority' | 'dueDate' | 'status'>('priority');

  const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

  const sorted = [...tasks].sort((a, b) => {
    if (sortKey === 'priority') return (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99);
    if (sortKey === 'dueDate') {
      if (!a.dueDate) return 1; if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    }
    return a.status.localeCompare(b.status);
  });

  return (
    <Card>
      <table className="w-full">
        <thead>
          <tr className="border-b border-zinc-100  text-left">
            {[
              { key: 'title', label: 'Task' },
              { key: 'priority', label: 'Priority' },
              { key: 'status', label: 'Status' },
              { key: 'dueDate', label: 'Due Date' },
              { key: 'assignee', label: 'Assignee' },
            ].map((h) => (
              <th
                key={h.key}
                className={cn('px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider cursor-pointer select-none hover:text-zinc-700', h.key !== 'title' && 'hidden sm:table-cell')}
                onClick={() => h.key in { priority: 1, dueDate: 1, status: 1 } && setSortKey(h.key as any)}
              >
                {h.label} {sortKey === h.key && '↑'}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 ">
          {sorted.map((task) => {
            const assignee = users.find((user) => user.id === task.assigneeId);
            const pCfg = priorityConfig[task.priority];
            const sCfg = statusConfig[task.status];
            const overdue = isOverdue(task.dueDate) && task.status !== 'done';
            return (
              <tr
                key={task.id}
                className="hover:bg-zinc-50  cursor-pointer transition-colors"
                onClick={() => setTaskDrawerId(task.id)}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', pCfg.dot)} />
                    <span className="text-sm text-zinc-800 ">{task.title}</span>
                    {task.visibility === 'internal' && viewingAs !== 'client' && (
                      <Lock size={10} className="text-zinc-400 flex-shrink-0" />
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <span className={cn('text-xs font-medium', pCfg.color)}>{pCfg.label}</span>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <Badge variant="zinc" className={cn('text-[10px]', sCfg.color)}>{sCfg.label}</Badge>
                </td>
                <td className={cn('px-4 py-3 text-xs hidden sm:table-cell', overdue ? 'text-red-500 font-medium' : 'text-zinc-500')}>
                  {task.dueDate ? formatDateShort(task.dueDate) : '—'}
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  {assignee ? (
                    <Avatar initials={assignee.initials} color={assignee.avatarColor} size="xs" title={assignee.name} />
                  ) : (
                    <span className="text-xs text-zinc-400">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {sorted.length === 0 && (
        <EmptyState icon={<List size={40} />} title="No tasks" description="No tasks in this project yet" />
      )}
    </Card>
  );
}

// ─── Timeline View ─────────────────────────────────────────────────────────────

function TimelineView({ projectId }: { projectId: string }) {
  const allTasks = useStore((s) => s.tasks);
  const project = useStore((s) => s.projects.find((p) => p.id === projectId));

  const tasks = allTasks.filter((task) => task.projectId === projectId && task.dueDate);

  if (!project) return null;

  const start = new Date(project.startDate).getTime();
  const end = new Date(project.dueDate).getTime();
  const totalMs = end - start;

  return (
    <Card>
      <div className="p-4">
        <h3 className="text-sm font-semibold text-zinc-700  mb-4">
          {formatDateShort(project.startDate)} → {formatDateShort(project.dueDate)}
        </h3>
        <div className="relative">
          {/* Timeline bar */}
          <div className="h-2 bg-zinc-100  rounded-full mb-8 relative">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-200 to-indigo-400   rounded-full" />
            {/* Today marker */}
            {(() => {
              const now = Date.now();
              const pct = Math.max(0, Math.min(100, ((now - start) / totalMs) * 100));
              return (
                <div className="absolute top-0 h-full flex flex-col items-center" style={{ left: `${pct}%` }}>
                  <div className="h-full w-0.5 bg-red-500" />
                  <span className="absolute -top-5 text-[9px] text-red-500 font-medium whitespace-nowrap -translate-x-1/2">Today</span>
                </div>
              );
            })()}
          </div>

          {/* Task markers */}
          <div className="space-y-2">
            {tasks.map((task) => {
              const pct = task.dueDate
                ? Math.max(0, Math.min(98, ((new Date(task.dueDate).getTime() - start) / totalMs) * 100))
                : 50;
              const pCfg = priorityConfig[task.priority];
              const overdue = isOverdue(task.dueDate) && task.status !== 'done';
              return (
                <div key={task.id} className="relative h-7 flex items-center">
                  <div
                    className="absolute flex items-center gap-2"
                    style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}
                  >
                    <div className={cn('h-3 w-3 rounded-full border-2 border-white ', pCfg.dot)} />
                  </div>
                  <div
                    className="absolute top-0"
                    style={{ left: `${Math.max(0, pct - 0)}%` }}
                  >
                    <div className="ml-4 flex items-center gap-1.5 bg-white  border border-zinc-200  rounded-md px-2 py-0.5 text-xs whitespace-nowrap shadow-sm">
                      <span className={cn(overdue ? 'text-red-500' : 'text-zinc-700 ')}>{task.title.slice(0, 30)}</span>
                      {task.dueDate && <span className={cn('font-medium', overdue ? 'text-red-500' : 'text-zinc-400')}>{formatDateShort(task.dueDate)}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {tasks.length === 0 && (
          <EmptyState icon={<CalendarDays size={40} />} title="No tasks with due dates" description="Assign due dates to tasks to see them here" />
        )}
      </div>
    </Card>
  );
}

// ─── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({ projectId }: { projectId: string }) {
  const viewingAs = useViewingAs();
  const workspaceId = useCurrentWorkspaceId();
  const allTasks = useStore((s) => s.tasks);
  const allTimeEntries = useStore((s) => s.timeEntries);
  const timeEntries = useMemo(() => allTimeEntries.filter((entry) => entry.workspaceId === workspaceId && entry.projectId === projectId), [allTimeEntries, workspaceId, projectId]);

  const tasks = allTasks.filter((task) => task.projectId === projectId);

  const counts = {
    todo: tasks.filter((t) => t.status === 'todo').length,
    in_progress: tasks.filter((t) => t.status === 'in_progress').length,
    in_review: tasks.filter((t) => t.status === 'in_review').length,
    done: tasks.filter((t) => t.status === 'done').length,
  };

  const totalHours = Math.round(timeEntries.reduce((s, t) => s + t.minutes, 0) / 60);

  const stats = [
    { label: 'Total Tasks', value: tasks.length, color: 'text-zinc-700 ' },
    { label: 'Todo', value: counts.todo, color: 'text-zinc-500' },
    { label: 'In Progress', value: counts.in_progress, color: 'text-blue-600' },
    { label: 'In Review', value: counts.in_review, color: 'text-purple-600' },
    { label: 'Done', value: counts.done, color: 'text-green-600' },
    ...(viewingAs !== 'client' ? [{ label: 'Hours Logged', value: totalHours, color: 'text-indigo-600' }] : []),
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {stats.map((s) => (
        <Card key={s.label} className="text-center p-4">
          <p className={cn('text-3xl font-bold', s.color)}>{s.value}</p>
          <p className="text-xs text-zinc-500 mt-1">{s.label}</p>
        </Card>
      ))}
    </div>
  );
}

// ─── Project Detail Page ───────────────────────────────────────────────────────

const TABS = [
  { id: 'board', label: 'Board', icon: <FolderKanban size={13} /> },
  { id: 'list', label: 'List', icon: <List size={13} /> },
  { id: 'timeline', label: 'Timeline', icon: <CalendarDays size={13} /> },
  { id: 'files', label: 'Files', icon: <FileText size={13} /> },
  { id: 'time', label: 'Time', icon: <Clock size={13} />, agencyOnly: true },
  { id: 'overview', label: 'Overview', icon: <BarChart2 size={13} /> },
];

export const ProjectDetailPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const viewingAs = useViewingAs();
  const workspaceId = useCurrentWorkspaceId();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('board');
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const storeProjects = useStore((s) => s.projects);
  const clients = useStore((s) => s.clients);
  const loadProject = useStore((s) => s.loadProject);
  const loadTasks = useStore((s) => s.loadTasks);

  useEffect(() => {
    if (!projectId) return;
    let active = true;
    setLoading(true);
    setNotFound(false);
    setLoadError(null);
    void loadProject(projectId).then(async (loadedProject) => {
      if (!active) return;
      if (!loadedProject) {
        setNotFound(true);
        return;
      }
      await loadTasks(projectId);
    }).catch((error: unknown) => {
      if (active) setLoadError(error instanceof Error ? error.message : 'Project could not be loaded');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [projectId, workspaceId, loadProject, loadTasks]);

  // 'c' shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (e.key === 'c' && viewingAs !== 'client') setNewTaskOpen(true);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [viewingAs]);

  if (!projectId) return <div>Not found</div>;

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <FolderKanban size={48} className="text-zinc-300 mb-4" />
        <h2 className="text-lg font-semibold text-zinc-700 ">Not found</h2>
        <p className="text-sm text-zinc-500 mt-1">This project doesn't exist or you don't have access.</p>
        <Button variant="secondary" className="mt-4" onClick={() => navigate('/projects')}>← Back to Projects</Button>
      </div>
    );
  }

  const project = storeProjects.find((p) => p.id === projectId);
  const client = project ? clients.find((item) => item.id === project.clientOrgId) : null;

  const visibleTabs = TABS.filter((t) => !t.agencyOnly || viewingAs !== 'client');

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-96" />
      </div>
    );
  }
  if (loadError) return <div role="alert" className="p-6 text-sm text-red-600">{loadError}</div>;

  if (!project) return <div className="p-6 text-zinc-500">Project not found.</div>;

  return (
    <div className="flex flex-col h-full">
      {/* Project Header */}
      <div className="px-6 pt-6 pb-0 border-b border-zinc-200 ">
        <button
          onClick={() => navigate('/projects')}
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-600 mb-3 transition-colors"
        >
          <ArrowLeft size={12} /> Projects
        </button>
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-zinc-900 ">{project.name}</h1>
              {viewingAs === 'client' && <Badge variant="green" className="text-[10px]">Client Portal</Badge>}
              <Badge
                variant={project.status === 'active' ? 'green' : project.status === 'on_hold' ? 'yellow' : 'zinc'}
                className="capitalize text-[10px]"
              >
                {project.status.replace('_', ' ')}
              </Badge>
            </div>
            <p className="text-sm text-zinc-500">{client?.name ?? project.clientName} · {formatDateShort(project.startDate)} – {formatDateShort(project.dueDate)}</p>
          </div>
          {viewingAs !== 'client' && (
            <Button variant="primary" size="sm" onClick={() => setNewTaskOpen(true)}>
              <Plus size={14} /> New Task <kbd className="ml-1 text-[9px] opacity-60 border border-white/30 rounded px-1">C</kbd>
            </Button>
          )}
        </div>

        <Tabs
          tabs={visibleTabs}
          active={activeTab}
          onChange={setActiveTab}
          className="border-b-0"
        />
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          {activeTab === 'board' && <BoardView projectId={projectId} />}
          {activeTab === 'list' && <ListView projectId={projectId} />}
          {activeTab === 'timeline' && <TimelineView projectId={projectId} />}
          {activeTab === 'files' && <FilesTab projectId={projectId} />}
          {activeTab === 'time' && viewingAs !== 'client' && <TimeTab projectId={projectId} />}
          {activeTab === 'overview' && <OverviewTab projectId={projectId} />}
        </div>
      </div>

      <NewTaskDialog
        open={newTaskOpen}
        onClose={() => setNewTaskOpen(false)}
        projectId={projectId}
        workspaceId={workspaceId}
      />
    </div>
  );
};
