import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore, useViewingAs, useCurrentWorkspaceId, useCurrentUserId } from '@/store';
import { projectAssignableMembers } from '@/lib/selectors';
import { activityForProject } from '@/lib/selectors';
import {
  Avatar, Badge, Button, Input, Label, Select, Textarea, Tabs, Switch, EmptyState,
} from '@/components/ui';
import {
  formatDateShort, isOverdue, priorityConfig, statusConfig, reviewConfig,
  relativeTime, formatMinutes, cn,
} from '@/lib/utils';
import {
  X, Lock, MessageSquare, Paperclip, Clock, Activity,
  Check, RefreshCw, Send,
} from 'lucide-react';
import type { Comment, TimeEntry, Task, Priority, TaskStatus, Visibility } from '@/types';

// ─── Comments Tab ─────────────────────────────────────────────────────────────

function CommentsTab({ taskId }: { taskId: string }) {
  const viewingAs = useViewingAs();
  const workspaceId = useCurrentWorkspaceId();
  const userId = useCurrentUserId();
  const addComment = useStore((s) => s.addComment);
  const pushToast = useStore((s) => s.pushToast);
  const allComments = useStore((s) => s.comments);
  const users = useStore((s) => s.users);

  const comments = allComments.filter((comment) => comment.taskId === taskId && comment.workspaceId === workspaceId);

  const [body, setBody] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setLoading(true);
    const comment: Comment = {
      id: `c-${Date.now()}`,
      taskId,
      workspaceId,
      authorId: userId,
      body,
      visibility: viewingAs === 'client' ? 'client' : isInternal ? 'internal' : 'client',
      createdAt: new Date().toISOString(),
      parentId: null,
    };
    try {
      await addComment(comment);
      pushToast({ title: 'Comment posted', variant: 'success' });
      setBody('');
    } catch (error) {
      pushToast({ title: 'Comment could not be posted', description: error instanceof Error ? error.message : 'Request failed', variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const currentUser = useStore((state) => state.session?.user);
  const user = users.find((item) => item.id === userId) ?? currentUser;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {comments.length === 0 ? (
          <EmptyState icon={<MessageSquare size={36} />} title="No comments yet" description="Start the conversation below" />
        ) : (
          comments.map((comment) => {
            const author = users.find((item) => item.id === comment.authorId)
              ?? (currentUser?.id === comment.authorId ? currentUser : undefined);
            return (
              <div key={comment.id} className="flex gap-3">
                <Avatar initials={author?.initials ?? '?'} color={author?.avatarColor} size="sm" className="flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-zinc-800 ">{author?.name}</span>
                    {comment.visibility === 'internal' && viewingAs !== 'client' && (
                      <Badge variant="zinc" className="text-[9px] flex items-center gap-0.5"><Lock size={8} /> Internal</Badge>
                    )}
                    <span className="text-xs text-zinc-400 ml-auto">{relativeTime(comment.createdAt)}</span>
                  </div>
                  <div className={cn(
                    'rounded-xl px-3 py-2 text-sm',
                    comment.visibility === 'internal'
                      ? 'bg-amber-50  border border-amber-200  text-zinc-700 '
                      : 'bg-zinc-100  text-zinc-800 ',
                  )}>
                    {comment.body}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Composer */}
      <form onSubmit={handleSubmit} className="border-t border-zinc-100  pt-4 space-y-3">
        {viewingAs !== 'client' && (
          <Switch
            checked={isInternal}
            onChange={setIsInternal}
            label="Internal note (hidden from client)"
          />
        )}
        <div className="flex gap-2">
          <Avatar initials={user?.initials ?? 'U'} color={user?.avatarColor} size="sm" className="flex-shrink-0 mt-1.5" />
          <div className="flex-1 relative">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={isInternal ? 'Internal note…' : 'Write a comment…'}
              rows={3}
              className={isInternal ? 'border-amber-300  bg-amber-50 ' : ''}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSubmit(e as any);
              }}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" variant="primary" size="sm" loading={loading} disabled={!body.trim()}>
            <Send size={13} /> Post
          </Button>
        </div>
      </form>
    </div>
  );
}

// ─── Files Tab in Drawer ───────────────────────────────────────────────────────

function DrawerFilesTab({ taskId }: { taskId: string }) {
  const viewingAs = useViewingAs();
  const workspaceId = useCurrentWorkspaceId();
  const updateFileReview = useStore((s) => s.updateFileReview);
  const pushToast = useStore((s) => s.pushToast);
  const allFiles = useStore((s) => s.files);

  const files = allFiles.filter((file) => file.taskId === taskId && file.workspaceId === workspaceId);

  const [note, setNote] = useState('');
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const approve = async (fileId: string, fileName: string) => {
    try {
      await updateFileReview(fileId, 'approved', null);
      pushToast({ title: `"${fileName}" approved`, variant: 'success' });
    } catch (error) {
      pushToast({ title: 'File review failed', description: error instanceof Error ? error.message : 'Request failed', variant: 'error' });
    }
  };

  const requestChanges = (fileId: string) => {
    if (!note.trim()) return;
    void updateFileReview(fileId, 'changes_requested', note).then(() => {
      pushToast({ title: 'Changes requested', variant: 'default' });
      setNote('');
      setReviewingId(null);
    }).catch((error: unknown) => {
      pushToast({ title: 'File review failed', description: error instanceof Error ? error.message : 'Request failed', variant: 'error' });
    });
  };

  return (
    <div className="space-y-3">
      {files.length === 0 ? (
        <EmptyState icon={<Paperclip size={36} />} title="No files attached" />
      ) : (
        files.map((file) => {
          const rCfg = reviewConfig[file.reviewStatus];
          return (
            <div key={file.id} className="border border-zinc-200  rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded bg-zinc-100  flex items-center justify-center">
                  <span className="text-[9px] font-bold text-zinc-500">{file.type}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-zinc-800  truncate">{file.name}</p>
                  <p className="text-[10px] text-zinc-400">{file.size}</p>
                </div>
                <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-md', rCfg.color)}>{rCfg.label}</span>
              </div>
              {file.reviewNote && (
                <p className="text-xs text-red-600 bg-red-50  rounded px-2 py-1">Note: {file.reviewNote}</p>
              )}
              {viewingAs === 'client' && file.reviewStatus === 'pending' && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Button variant="primary" size="sm" onClick={() => approve(file.id, file.name)}>
                      <Check size={11} /> Approve
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setReviewingId(reviewingId === file.id ? null : file.id)}>
                      <RefreshCw size={11} /> Request Changes
                    </Button>
                  </div>
                  {reviewingId === file.id && (
                    <div className="space-y-2">
                      <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Describe the changes needed…" rows={2} />
                      <Button variant="danger" size="sm" onClick={() => requestChanges(file.id)}>Submit</Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// ─── Time Tab in Drawer ────────────────────────────────────────────────────────

function DrawerTimeTab({ taskId }: { taskId: string }) {
  const workspaceId = useCurrentWorkspaceId();
  const userId = useCurrentUserId();
  const addTimeEntry = useStore((s) => s.addTimeEntry);
  const pushToast = useStore((s) => s.pushToast);
  const allTime = useStore((s) => s.timeEntries);
  const task = useStore((s) => s.tasks.find((t) => t.id === taskId));

  const entries = allTime.filter((e) => e.taskId === taskId);
  const [minutes, setMinutes] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');

  const handleLog = async (e: React.FormEvent) => {
    e.preventDefault();
    const mins = parseInt(minutes, 10);
    if (isNaN(mins)) return;
    const entry: TimeEntry = {
      id: `te-${Date.now()}`,
      workspaceId,
      projectId: task?.projectId ?? '',
      taskId,
      userId,
      minutes: mins,
      date,
      note,
    };
    try {
      await addTimeEntry(entry);
      pushToast({ title: `${formatMinutes(mins)} logged`, variant: 'success' });
      setMinutes(''); setNote('');
    } catch (error) {
      pushToast({ title: 'Time could not be logged', description: error instanceof Error ? error.message : 'Request failed', variant: 'error' });
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleLog} className="grid grid-cols-3 gap-2">
        <Input type="number" value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="Mins" min="1" required className="text-sm" />
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="text-sm" />
        <Button type="submit" variant="primary" size="sm">Log</Button>
        <div className="col-span-3">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="text-sm" />
        </div>
      </form>
      <div className="space-y-2">
        {entries.map((e) => {
          const u = useStore.getState().users.find((user) => user.id === e.userId);
          return (
            <div key={e.id} className="flex items-center gap-2 text-sm">
              <Avatar initials={u?.initials ?? '?'} color={u?.avatarColor} size="xs" />
              <span className="flex-1 text-zinc-600  truncate">{e.note || 'No note'}</span>
              <span className="text-indigo-600 font-medium text-xs">{formatMinutes(e.minutes)}</span>
            </div>
          );
        })}
        {entries.length === 0 && <p className="text-xs text-zinc-400 text-center py-4">No time logged on this task</p>}
      </div>
    </div>
  );
}

// ─── Activity Tab in Drawer ───────────────────────────────────────────────────

function TaskActivityTab({ taskId }: { taskId: string }) {
  const allActivity = useStore((state) => state.activity);
  // Grab the project from the task
  const task = useStore((s) => s.tasks.find((t) => t.id === taskId));
  const entries = activityForProject(task?.projectId, allActivity)
    .filter((a) => a.taskId === taskId);
  const users = useStore((state) => state.users);

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Activity size={36} className="text-zinc-300  mb-3" />
        <p className="text-sm text-zinc-500">No activity on this task yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => {
        const actor = users.find((user) => user.id === entry.actorId);
        return (
          <div key={entry.id} className="flex gap-3 items-start">
            <Avatar initials={actor?.initials ?? '?'} color={actor?.avatarColor} size="xs" className="mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-zinc-600  leading-tight">
                <span className="font-medium text-zinc-800 ">{actor?.name}</span>{' '}
                {activityLabel(entry.type, entry.meta)}
              </p>
              <p className="text-[10px] text-zinc-400 mt-0.5">{relativeTime(entry.createdAt)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function activityLabel(type: string, meta: Record<string, string>): string {
  switch (type) {
    case 'task_created': return `created this task`;
    case 'task_moved': return `moved task from ${meta.from} to ${meta.to}`;
    case 'task_assigned': return `assigned the task`;
    case 'comment_added': return `commented: "${(meta.comment ?? '').slice(0, 50)}…"`;
    case 'file_uploaded': return `uploaded "${meta.fileName ?? ''}"`;
    case 'file_approved': return `approved "${meta.fileName ?? ''}"`;
    case 'file_changes_requested': return `requested changes on "${meta.fileName ?? ''}"`;
    default: return type.replace(/_/g, ' ');
  }
}

// ─── Main Task Drawer ─────────────────────────────────────────────────────────

export const TaskDrawer: React.FC = () => {
  const taskDrawerId = useStore((s) => s.taskDrawerId);
  const setTaskDrawerId = useStore((s) => s.setTaskDrawerId);
  const updateTask = useStore((s) => s.updateTask);
  const pushToast = useStore((s) => s.pushToast);
  const viewingAs = useViewingAs();
  const workspaceId = useCurrentWorkspaceId();
  const task = useStore((s) => s.tasks.find((t) => t.id === taskDrawerId));
  const loadTaskDetail = useStore((s) => s.loadTaskDetail);
  const loadActivity = useStore((s) => s.loadActivity);
  const taskDetailState = useStore((s) => s.taskDetailState);
  const projects = useStore((s) => s.projects);
  const members = useStore((s) => s.members);
  const users = useStore((s) => s.users);
  const [activeTab, setActiveTab] = useState('comments');
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
      setActiveTab('comments');
    }
  }, [task?.id, task?.description]);

  useEffect(() => {
    if (!taskDrawerId) return;
    void Promise.all([loadTaskDetail(taskDrawerId), loadActivity()]).catch((error: unknown) => {
      pushToast({ title: 'Task details could not be loaded', description: error instanceof Error ? error.message : 'Request failed', variant: 'error' });
    });
  }, [taskDrawerId, loadTaskDetail, loadActivity, pushToast]);

  const close = () => setTaskDrawerId(null);

  const assignable = task ? projectAssignableMembers(workspaceId, task.projectId, projects, members) : [];
  const saveTaskPatch = (patch: Partial<Task>, success?: string) => {
    if (!task) return;
    if (patch.title === task.title || patch.description === task.description) return;
    void updateTask(task.id, patch).then(() => {
      if (success) pushToast({ title: success, variant: 'success' });
    }).catch((error: unknown) => {
      pushToast({ title: 'Task update failed', description: error instanceof Error ? error.message : 'Request failed', variant: 'error' });
    });
  };

  const drawerTabs = [
    { id: 'comments', label: 'Comments', icon: <MessageSquare size={12} /> },
    { id: 'files', label: 'Files', icon: <Paperclip size={12} /> },
    ...(viewingAs !== 'client' ? [
      { id: 'time', label: 'Time', icon: <Clock size={12} /> },
    ] : []),
    { id: 'activity', label: 'Activity', icon: <Activity size={12} /> },
  ];

  return (
    <AnimatePresence>
      {taskDrawerId && task && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 z-40"
            onClick={close}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-xl bg-white  border-l border-zinc-200  flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-100 ">
              <div className="flex-1 min-w-0">
                {editingTitle && viewingAs !== 'client' ? (
                  <input
                    className="w-full text-base font-semibold bg-transparent border-b-2 border-indigo-500 focus:outline-none text-zinc-900 "
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={() => {
                      saveTaskPatch({ title });
                      setEditingTitle(false);
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { saveTaskPatch({ title }); setEditingTitle(false); } }}
                    autoFocus
                  />
                ) : (
                  <h2
                    className="text-base font-semibold text-zinc-900  cursor-pointer hover:text-indigo-600 transition-colors truncate"
                    onClick={() => viewingAs !== 'client' && setEditingTitle(true)}
                    title={viewingAs !== 'client' ? 'Click to edit' : undefined}
                  >
                    {task.title}
                  </h2>
                )}
              </div>
              {task.visibility === 'internal' && viewingAs !== 'client' && (
                <Badge variant="zinc" className="text-[9px] flex items-center gap-0.5 flex-shrink-0"><Lock size={8} /> Internal</Badge>
              )}
              <button onClick={close} className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100  transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Meta fields */}
            <div className="px-5 py-4 grid grid-cols-2 gap-x-4 gap-y-3 border-b border-zinc-100 ">
              {/* Status */}
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-zinc-400">Status</Label>
                {viewingAs !== 'client' ? (
                  <Select
                    value={task.status}
                    onChange={(v) => saveTaskPatch({ status: v as TaskStatus }, 'Status updated')}
                    options={Object.entries(statusConfig).map(([k, v]) => ({ value: k, label: v.label }))}
                    className="mt-1 h-8 text-xs"
                  />
                ) : (
                  <Badge variant="zinc" className={cn('mt-1 text-[10px]', statusConfig[task.status].color)}>{statusConfig[task.status].label}</Badge>
                )}
              </div>

              {/* Priority */}
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-zinc-400">Priority</Label>
                {viewingAs !== 'client' ? (
                  <Select
                    value={task.priority}
                    onChange={(v) => saveTaskPatch({ priority: v as Priority }, 'Priority updated')}
                    options={(['urgent', 'high', 'medium', 'low'] as Priority[]).map((p) => ({ value: p, label: priorityConfig[p].label }))}
                    className="mt-1 h-8 text-xs"
                  />
                ) : (
                  <span className={cn('text-xs font-medium mt-1 block', priorityConfig[task.priority].color)}>{priorityConfig[task.priority].label}</span>
                )}
              </div>

              {/* Assignee */}
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-zinc-400">Assignee</Label>
                {viewingAs !== 'client' ? (
                  <Select
                    value={task.assigneeId ?? ''}
                    onChange={(v) => saveTaskPatch({ assigneeId: v || null }, 'Assignee updated')}
                    options={[{ value: '', label: 'Unassigned' }, ...assignable.map((m) => {
                      const u = m.user;
                      return { value: m.userId, label: u?.name ?? m.userId };
                    })]}
                    className="mt-1 h-8 text-xs"
                  />
                ) : (
                  <div className="flex items-center gap-2 mt-1">
                    {task.assigneeId ? (
                      (() => { const u = users.find((user) => user.id === task.assigneeId); return u ? <><Avatar initials={u.initials} color={u.avatarColor} size="xs" /><span className="text-xs text-zinc-600 ">{u.name}</span></> : null; })()
                    ) : <span className="text-xs text-zinc-400">Unassigned</span>}
                  </div>
                )}
              </div>

              {/* Due Date */}
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-zinc-400">Due Date</Label>
                {viewingAs !== 'client' ? (
                  <Input
                    type="date"
                    value={task.dueDate ?? ''}
                    onChange={(e) => saveTaskPatch({ dueDate: e.target.value || null })}
                    className="mt-1 h-8 text-xs"
                  />
                ) : (
                  <span className={cn('text-xs mt-1 block', isOverdue(task.dueDate) && task.status !== 'done' ? 'text-red-500 font-medium' : 'text-zinc-600 ')}>
                    {task.dueDate ? formatDateShort(task.dueDate) : '—'}
                  </span>
                )}
              </div>

              {/* Visibility (agency only) */}
              {viewingAs !== 'client' && (
                <div className="col-span-2">
                  <Label className="text-[10px] uppercase tracking-wider text-zinc-400">Visibility</Label>
                  <div className="flex gap-2 mt-1">
                    {(['client', 'internal'] as Visibility[]).map((v) => (
                      <button
                        key={v}
                        onClick={() => saveTaskPatch({ visibility: v }, 'Visibility updated')}
                        className={cn(
                          'px-3 py-1 rounded-lg text-xs border transition-colors',
                          task.visibility === v
                            ? 'border-indigo-500 bg-indigo-50  text-indigo-700 '
                            : 'border-zinc-200  text-zinc-500 hover:border-zinc-300',
                        )}
                      >
                        {v === 'client' ? '👁 Client-visible' : '🔒 Internal'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="px-5 py-3 border-b border-zinc-100 ">
              <Label className="text-[10px] uppercase tracking-wider text-zinc-400">Description</Label>
              {viewingAs !== 'client' ? (
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={() => saveTaskPatch({ description })}
                  placeholder="Add a description…"
                  rows={2}
                  className="mt-1 text-sm border-none bg-transparent focus:ring-0 px-0 resize-none"
                />
              ) : (
                <p className="mt-1 text-sm text-zinc-600 ">{task.description || '—'}</p>
              )}
            </div>

            {/* Tabs */}
            <Tabs tabs={drawerTabs} active={activeTab} onChange={setActiveTab} className="px-5 border-b-0" />

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {taskDetailState.loading && <p className="mb-3 text-xs text-zinc-400">Refreshing task details…</p>}
              {taskDetailState.error && <p role="alert" className="mb-3 text-xs text-red-600">{taskDetailState.error}</p>}
              {activeTab === 'comments' && <CommentsTab taskId={task.id} />}
              {activeTab === 'files' && <DrawerFilesTab taskId={task.id} />}
              {activeTab === 'time' && viewingAs !== 'client' && <DrawerTimeTab taskId={task.id} />}
              {activeTab === 'activity' && (
                <TaskActivityTab taskId={task.id} />
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
