import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useStore, useViewingAs, useCurrentWorkspaceId } from '@/store';
import {
  Button, Card, Badge, Input, Select, Skeleton, EmptyState,
  Dialog, DialogContent, DialogHeader, DialogTitle, Label, Textarea, ProgressBar,
} from '@/components/ui';
import { formatDateShort, projectProgress, cn } from '@/lib/utils';
import { Plus, Search, LayoutGrid, List, FolderKanban, Calendar } from 'lucide-react';
import type { Project } from '@/types';

// ─── New Project Modal ─────────────────────────────────────────────────────────

function NewProjectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const workspaceId = useCurrentWorkspaceId();
  const addProject = useStore((s) => s.addProject);
  const pushToast = useStore((s) => s.pushToast);
  const allClients = useStore((s) => s.clients);
  const clients = useMemo(() => allClients.filter((client) => client.workspaceId === workspaceId), [allClients, workspaceId]);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [clientOrgId, setClientOrgId] = useState(clients[0]?.id ?? '');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!clientOrgId && clients.length > 0) setClientOrgId(clients[0].id);
  }, [clients, clientOrgId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const project: Project = {
      id: '',
      workspaceId,
      name,
      description,
      clientOrgId,
      status: 'active',
      startDate: startDate || new Date().toISOString().slice(0, 10),
      dueDate: dueDate || new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
      memberIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      await addProject(project);
      pushToast({ title: `Project "${name}" created`, variant: 'success' });
      onClose();
      setName(''); setDescription('');
    } catch (error) {
      pushToast({ title: 'Project creation failed', description: error instanceof Error ? error.message : 'Request failed', variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-zinc-900 ">New Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="proj-name">Project Name</Label>
            <Input id="proj-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Brand Redesign Q1" required className="mt-1" />
          </div>
          <div>
            <Label htmlFor="proj-desc">Description</Label>
            <Textarea id="proj-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief overview of the project…" rows={3} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="proj-client">Client</Label>
            <Select
              id="proj-client"
              value={clientOrgId}
              onChange={setClientOrgId}
              options={clients.map((c) => ({ value: c.id, label: c.name }))}
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="proj-start">Start Date</Label>
              <Input id="proj-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="proj-due">Due Date</Label>
              <Input id="proj-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" className="flex-1" loading={loading}>Create Project</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Project Card ─────────────────────────────────────────────────────────────

function ProjectCard({ project, onClick }: { project: Project & { progress: number; taskCount: number }; onClick: () => void }) {
  const client = useStore((s) => s.clients.find((item) => item.id === project.clientOrgId));

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -2 }} transition={{ duration: 0.15 }}>
      <Card className="cursor-pointer hover:shadow-md transition-shadow p-4" onClick={onClick}>
        <div className="flex items-start justify-between mb-3">
          <div className="h-9 w-9 rounded-lg bg-indigo-100  flex items-center justify-center flex-shrink-0">
            <FolderKanban size={18} className="text-indigo-600 " />
          </div>
          <Badge
            variant={project.status === 'active' ? 'green' : project.status === 'on_hold' ? 'yellow' : 'zinc'}
            className="capitalize text-[10px]"
          >
            {project.status.replace('_', ' ')}
          </Badge>
        </div>
        <h3 className="font-semibold text-zinc-900  text-sm mb-1">{project.name}</h3>
        <p className="text-xs text-zinc-500 mb-3 line-clamp-2">{project.description}</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>{project.taskCount} tasks</span>
            <span>{project.progress}%</span>
          </div>
          <ProgressBar value={project.progress} />
        </div>
        <div className="flex items-center justify-between mt-3 text-xs text-zinc-500">
          <span className="flex items-center gap-1"><Calendar size={11} /> {formatDateShort(project.dueDate)}</span>
          {(client?.name ?? project.clientName) && <span className="text-zinc-400">{client?.name ?? project.clientName}</span>}
        </div>
      </Card>
    </motion.div>
  );
}

// ─── Project Row ──────────────────────────────────────────────────────────────

function ProjectRow({ project, onClick }: { project: Project & { progress: number; taskCount: number }; onClick: () => void }) {
  const client = useStore((s) => s.clients.find((item) => item.id === project.clientOrgId));
  return (
    <tr
      className="hover:bg-zinc-50  cursor-pointer transition-colors"
      onClick={onClick}
    >
      <td className="px-4 py-3">
        <p className="text-sm font-medium text-zinc-800 ">{project.name}</p>
        <p className="text-xs text-zinc-500 mt-0.5">{client?.name ?? project.clientName}</p>
      </td>
      <td className="px-4 py-3">
        <Badge variant={project.status === 'active' ? 'green' : project.status === 'on_hold' ? 'yellow' : 'zinc'} className="capitalize text-[10px]">
          {project.status.replace('_', ' ')}
        </Badge>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <ProgressBar value={project.progress} className="w-24" />
          <span className="text-xs text-zinc-500">{project.progress}%</span>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-zinc-500">{project.taskCount}</td>
      <td className="px-4 py-3 text-xs text-zinc-500">{formatDateShort(project.dueDate)}</td>
    </tr>
  );
}

// ─── Projects Page ────────────────────────────────────────────────────────────

export const ProjectsPage: React.FC = () => {
  const viewingAs = useViewingAs();
  const workspaceId = useCurrentWorkspaceId();
  const navigate = useNavigate();
  const loadProjects = useStore((s) => s.loadProjects);
  const loadClients = useStore((s) => s.loadClients);
  const projectsState = useStore((s) => s.projectState);
  const taskState = useStore((s) => s.taskState);
  const storeProjects = useStore((s) => s.projects);
  const storeTasks = useStore((s) => s.tasks);

  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [newProjectOpen, setNewProjectOpen] = useState(false);

  useEffect(() => {
    void loadProjects().catch((error: unknown) => {
      useStore.getState().pushToast({ title: 'Projects could not be loaded', description: error instanceof Error ? error.message : 'Request failed', variant: 'error' });
    });
    if (viewingAs === 'admin') void loadClients().catch((error: unknown) => {
      useStore.getState().pushToast({ title: 'Clients could not be loaded', description: error instanceof Error ? error.message : 'Request failed', variant: 'error' });
    });
  }, [workspaceId, viewingAs, loadProjects, loadClients]);

  useEffect(() => {
    void Promise.all(storeProjects.map((project) => useStore.getState().loadTasks(project.id)))
      .catch((error: unknown) => useStore.getState().pushToast({
        title: 'Project tasks could not be loaded',
        description: error instanceof Error ? error.message : 'Request failed',
        variant: 'error',
      }));
  }, [storeProjects]);

  const allProjects = storeProjects;

  const projects = allProjects
    .filter((p) =>
      (statusFilter === 'all' || p.status === statusFilter) &&
      p.name.toLowerCase().includes(search.toLowerCase()),
    )
    .map((p) => {
      const ptasks = storeTasks.filter((task) => task.projectId === p.id);
      return { ...p, progress: projectProgress(ptasks), taskCount: ptasks.length };
    });
  const loading = projectsState.loading || (taskState.loading && projects.length > 0);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 ">Projects</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{allProjects.length} project{allProjects.length !== 1 ? 's' : ''}</p>
        </div>
        {viewingAs === 'admin' && (
          <Button variant="primary" onClick={() => setNewProjectOpen(true)}>
            <Plus size={15} /> New Project
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search projects…" className="pl-8" />
        </div>
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'all', label: 'All Statuses' },
            { value: 'active', label: 'Active' },
            { value: 'on_hold', label: 'On Hold' },
            { value: 'completed', label: 'Completed' },
            { value: 'archived', label: 'Archived' },
          ]}
          className="w-40"
        />
        <div className="flex border border-zinc-200  rounded-lg overflow-hidden">
          <button
            onClick={() => setView('grid')}
            className={cn('p-2 transition-colors', view === 'grid' ? 'bg-indigo-50  text-indigo-600' : 'text-zinc-400 hover:text-zinc-600')}
          >
            <LayoutGrid size={16} />
          </button>
          <button
            onClick={() => setView('list')}
            className={cn('p-2 transition-colors', view === 'list' ? 'bg-indigo-50  text-indigo-600' : 'text-zinc-400 hover:text-zinc-600')}
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      {(projectsState.error || taskState.error) && (
        <p role="alert" className="mb-4 text-sm text-red-600">{projectsState.error ?? taskState.error}</p>
      )}
      {loading ? (
        <div className={view === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-3'}>
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={<FolderKanban size={48} />}
          title="No projects found"
          description={search ? 'Try a different search term or filter' : "You haven't been assigned to any projects yet"}
          action={viewingAs === 'admin' ? <Button variant="primary" onClick={() => setNewProjectOpen(true)}><Plus size={14} /> Create your first project</Button> : undefined}
        />
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} onClick={() => navigate(`/projects/${p.id}`)} />
          ))}
        </div>
      ) : (
        <Card>
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100  text-left">
                {['Project', 'Status', 'Progress', 'Tasks', 'Due Date'].map((h) => (
                  <th key={h} className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 ">
              {projects.map((p) => (
                <ProjectRow key={p.id} project={p} onClick={() => navigate(`/projects/${p.id}`)} />
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <NewProjectModal open={newProjectOpen} onClose={() => setNewProjectOpen(false)} />
    </div>
  );
};
