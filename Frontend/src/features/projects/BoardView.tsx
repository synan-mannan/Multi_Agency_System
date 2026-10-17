import React, { useState, useEffect } from 'react';
import {
  DndContext, DragOverlay, useDraggable, useDroppable,
  PointerSensor, useSensor, useSensors, closestCenter,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore, useViewingAs, useCurrentWorkspaceId } from '@/store';
import { projectAssignableMembers } from '@/lib/selectors';
import { Avatar, Badge, Input, Select, Button, EmptyState, Skeleton } from '@/components/ui';
import { formatDateShort, isOverdue, priorityConfig, cn } from '@/lib/utils';
import { Lock, MessageSquare, Paperclip, Plus, Search } from 'lucide-react';
import type { Priority, Task, TaskStatus } from '@/types';
import { NewTaskDialog } from '@/pages/ProjectDetailPage';

// ─── Column config ─────────────────────────────────────────────────────────────

const COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: 'todo', label: 'Todo' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'in_review', label: 'In Review' },
  { id: 'done', label: 'Done' },
];
const PRIORITIES: Priority[] = ['urgent', 'high', 'medium', 'low'];
const isPriority = (value: string): value is Priority => PRIORITIES.some((priority) => priority === value);

// ─── Task Card ─────────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: Task;
  isDragging?: boolean;
}

export function TaskCard({ task, isDragging }: TaskCardProps) {
  const setTaskDrawerId = useStore((s) => s.setTaskDrawerId);
  const users = useStore((s) => s.users);
  const viewingAs = useViewingAs();
  const pCfg = priorityConfig[task.priority];
  const overdue = isOverdue(task.dueDate) && task.status !== 'done';
  const assignee = users.find((user) => user.id === task.assigneeId);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: isDragging ? 0.5 : 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        'bg-white  border border-zinc-200  rounded-xl p-3 shadow-sm',
        'hover:shadow-md hover:border-zinc-300  transition-all duration-150',
        'cursor-pointer group',
        isDragging && 'opacity-50 rotate-1',
      )}
      onClick={(e) => { e.stopPropagation(); setTaskDrawerId(task.id); }}
    >
      {/* Priority dot + title */}
      <div className="flex items-start gap-2 mb-2">
        <span className={cn('h-2 w-2 rounded-full mt-1.5 flex-shrink-0', pCfg.dot)} title={pCfg.label} />
        <p className="text-sm font-medium text-zinc-800  leading-snug flex-1">{task.title}</p>
        {task.visibility === 'internal' && viewingAs !== 'client' && (
          <Badge variant="zinc" className="flex items-center gap-0.5 text-[9px] flex-shrink-0">
            <Lock size={8} /> Internal
          </Badge>
        )}
      </div>

      {/* Due date + assignee + counts */}
      <div className="flex items-center gap-2 flex-wrap">
        {task.dueDate && (
          <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', overdue ? 'bg-red-100 text-red-600  ' : 'bg-zinc-100 text-zinc-500 ')}>
            {formatDateShort(task.dueDate)}
          </span>
        )}
        <div className="flex-1" />
        {task.commentCount > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] text-zinc-400">
            <MessageSquare size={10} /> {task.commentCount}
          </span>
        )}
        {task.fileCount > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] text-zinc-400">
            <Paperclip size={10} /> {task.fileCount}
          </span>
        )}
        {assignee ? (
          <Avatar initials={assignee.initials} color={assignee.avatarColor} size="xs" title={assignee.name} />
        ) : (
          <div className="h-5 w-5 rounded-full bg-zinc-100  border-2 border-dashed border-zinc-300 " title="Unassigned" />
        )}
      </div>
    </motion.div>
  );
}

// ─── Draggable Task Card ───────────────────────────────────────────────────────

function DraggableTaskCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={isDragging ? 'opacity-40' : ''}>
      <TaskCard task={task} isDragging={isDragging} />
    </div>
  );
}

// ─── Column ───────────────────────────────────────────────────────────────────

interface ColumnProps {
  col: typeof COLUMNS[0];
  tasks: Task[];
  canDrag: boolean;
  onAddTask?: () => void;
}

function Column({ col, tasks, canDrag, onAddTask }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });

  return (
    <div className="flex flex-col gap-2 min-w-[260px] w-72">
      {/* Column header */}
      <div className="flex items-center gap-2 px-1">
        <div className="flex items-center gap-2 flex-1">
          <h3 className="text-xs font-semibold text-zinc-600  uppercase tracking-wider">{col.label}</h3>
          <span className="text-[10px] font-medium bg-zinc-100  text-zinc-500 rounded-full px-2 py-0.5">{tasks.length}</span>
        </div>
        {onAddTask && (
          <button
            onClick={onAddTask}
            className="text-zinc-400 hover:text-indigo-600 transition-colors"
            title="Add task (C)"
          >
            <Plus size={14} />
          </button>
        )}
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex flex-col gap-2 rounded-xl p-2 min-h-[120px] transition-colors duration-150',
          isOver ? 'bg-indigo-50  border-2 border-dashed border-indigo-300 ' : 'bg-zinc-50 ',
        )}
      >
        <AnimatePresence>
          {tasks.map((task) =>
            canDrag ? (
              <DraggableTaskCard key={task.id} task={task} />
            ) : (
              <TaskCard key={task.id} task={task} />
            ),
          )}
        </AnimatePresence>
        {tasks.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-xs text-zinc-300  py-4">
            Drop here
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Board View ────────────────────────────────────────────────────────────────

export const BoardView: React.FC<{ projectId: string }> = ({ projectId }) => {
  const viewingAs = useViewingAs();
  const workspaceId = useCurrentWorkspaceId();
  const moveTask = useStore((s) => s.moveTask);
  const allTasks = useStore((s) => s.tasks);
  const taskState = useStore((s) => s.taskState);
  const projects = useStore((s) => s.projects);
  const members = useStore((s) => s.members);
  const loadTasks = useStore((s) => s.loadTasks);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | ''>('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<Priority | ''>('');
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [newTaskOpen, setNewTaskOpen] = useState(false);

  const canDrag = viewingAs !== 'client';

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const assignableMembers = projectAssignableMembers(workspaceId, projectId, projects, members);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadTasks(projectId, {
        q: search.trim() || undefined,
        status: statusFilter || undefined,
        assignee: assigneeFilter || undefined,
        priority: priorityFilter || undefined,
      }).catch((error: unknown) => useStore.getState().pushToast({
        title: 'Tasks could not be loaded',
        description: error instanceof Error ? error.message : 'Request failed',
        variant: 'error',
      }));
    }, 300);
    return () => clearTimeout(timer);
  }, [projectId, search, statusFilter, assigneeFilter, priorityFilter, loadTasks]);

  const tasks = allTasks.filter((task) => task.projectId === projectId && task.workspaceId === workspaceId);

  const activeTask = activeTaskId ? allTasks.find((t) => t.id === activeTaskId) : null;

  const handleDragStart = (e: DragStartEvent) => setActiveTaskId(String(e.active.id));

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveTaskId(null);
    const { active, over } = e;
    if (!over) return;
    const newStatus = String(over.id) as TaskStatus;
    const task = allTasks.find((t) => t.id === String(active.id));
    if (!task || task.status === newStatus) return;
    moveTask(String(active.id), newStatus);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter tasks…" className="pl-8 h-8 w-48 text-xs" />
        </div>
        <Select
          value={statusFilter}
          onChange={(value) => setStatusFilter(value as TaskStatus | '')}
          options={[{ value: '', label: 'All Statuses' }, ...COLUMNS.map((column) => ({ value: column.id, label: column.label }))]}
          className="h-8 text-xs w-36"
        />
        <Select
          value={assigneeFilter}
          onChange={setAssigneeFilter}
          options={[{ value: '', label: 'All Assignees' }, ...assignableMembers.map((m) => {
            return { value: m.userId, label: m.user?.name ?? m.userId };
          })]}
          className="h-8 text-xs w-36"
        />
        <Select
          value={priorityFilter}
          onChange={(value) => setPriorityFilter(isPriority(value) ? value : '')}
          options={[{ value: '', label: 'All Priorities' }, ...PRIORITIES.map((priority) => ({ value: priority, label: priorityConfig[priority].label }))]}
          className="h-8 text-xs w-36"
        />
        {(search || statusFilter || assigneeFilter || priorityFilter) && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setStatusFilter(''); setAssigneeFilter(''); setPriorityFilter(''); }}>
            Clear filters
          </Button>
        )}
      </div>

      {taskState.error && <p role="alert" className="text-sm text-red-600">{taskState.error}</p>}
      {taskState.loading && <p className="text-xs text-zinc-400">Loading tasks…</p>}
      {taskState.loading && tasks.length === 0 ? (
        <Skeleton className="h-72" />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={<Search size={36} />}
          title={search || statusFilter || assigneeFilter || priorityFilter ? 'No matching tasks' : 'No tasks yet'}
          description={search || statusFilter || assigneeFilter || priorityFilter ? 'Try a different search term or filter' : 'Add a task to get this project moving'}
          action={viewingAs !== 'client' && !search && !statusFilter && !assigneeFilter && !priorityFilter ? (
            <Button variant="primary" size="sm" onClick={() => setNewTaskOpen(true)}>Add task</Button>
          ) : undefined}
        />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
            {COLUMNS.map((col) => (
              <Column
                key={col.id}
                col={col}
                tasks={tasks.filter((t) => t.status === col.id)}
                canDrag={canDrag}
                onAddTask={viewingAs !== 'client' ? () => setNewTaskOpen(true) : undefined}
              />
            ))}
          </div>
          <DragOverlay>
            {activeTask && <TaskCard task={activeTask} isDragging />}
          </DragOverlay>
        </DndContext>
      )}

      <NewTaskDialog
        open={newTaskOpen}
        onClose={() => setNewTaskOpen(false)}
        projectId={projectId}
        workspaceId={workspaceId}
      />
    </div>
  );
};
