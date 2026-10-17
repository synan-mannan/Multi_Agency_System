import React, { useState, useEffect, useMemo } from 'react';
import { useStore, useCurrentWorkspaceId, useCurrentUserId } from '@/store';
import { Card, Button, Input, Label, Avatar, EmptyState, Select } from '@/components/ui';
import { formatMinutes, formatDate } from '@/lib/utils';
import { Clock, Plus } from 'lucide-react';
import type { TimeEntry } from '@/types';

export const TimeTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const workspaceId = useCurrentWorkspaceId();
  const userId = useCurrentUserId();
  const addTimeEntry = useStore((s) => s.addTimeEntry);
  const pushToast = useStore((s) => s.pushToast);
  const allTime = useStore((s) => s.timeEntries);
  const allTasks = useStore((s) => s.tasks);
  const tasks = useMemo(() => allTasks.filter((task) => task.projectId === projectId), [allTasks, projectId]);
  const allMembers = useStore((s) => s.members);
  const members = useMemo(
    () => allMembers.filter((member) => member.workspaceId === workspaceId && member.role !== 'client'),
    [allMembers, workspaceId],
  );
  const users = useStore((s) => s.users);
  const loadProjectTime = useStore((s) => s.loadProjectTime);
  const loadHours = useStore((s) => s.loadHours);
  const hours = useStore((s) => s.hours);
  const timeState = useStore((s) => s.timeState);

  const entries = useMemo(() => allTime.filter((entry) => entry.workspaceId === workspaceId && entry.projectId === projectId), [allTime, workspaceId, projectId]);
  useEffect(() => {
    void Promise.all([loadProjectTime(projectId), loadHours(projectId)]).catch((error: unknown) => {
      pushToast({ title: 'Time data could not be loaded', description: error instanceof Error ? error.message : 'Request failed', variant: 'error' });
    });
  }, [projectId, loadProjectTime, loadHours, pushToast]);

  const [minutes, setMinutes] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [taskId, setTaskId] = useState('');

  useEffect(() => {
    if (!tasks.some((task) => task.id === taskId) && tasks[0]) setTaskId(tasks[0].id);
  }, [tasks, taskId]);

  // Per-member summary
  const memberSummary = members.map((m) => {
    const total = entries.filter((e) => e.userId === m.userId).reduce((s, e) => s + e.minutes, 0);
    return { member: m, total };
  }).filter((m) => m.total > 0 || entries.some((e) => e.userId === m.member.userId));

  const handleLog = async (e: React.FormEvent) => {
    e.preventDefault();
    const mins = parseInt(minutes, 10);
    if (isNaN(mins) || mins <= 0) return;
    if (!tasks.some((task) => task.id === taskId)) {
      pushToast({ title: 'Time cannot be logged', description: 'Select a task before logging time.', variant: 'error' });
      return;
    }
    setLoading(true);
    const entry: TimeEntry = {
      id: `te-${Date.now()}`,
      workspaceId,
      projectId,
      taskId,
      userId,
      minutes: mins,
      date,
      note,
    };
    try {
      await addTimeEntry(entry);
      await Promise.all([loadProjectTime(projectId), loadHours(projectId)]);
      pushToast({ title: `${formatMinutes(mins)} logged`, variant: 'success' });
      setMinutes(''); setNote('');
    } catch (error) {
      pushToast({ title: 'Time could not be logged', description: error instanceof Error ? error.message : 'Request failed', variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const totalHours = Math.round((hours.data?.total_hours ?? entries.reduce((s, entry) => s + entry.minutes, 0) / 60));

  return (
    <div className="space-y-6">
      {/* Summary */}
      {hours.error && <p role="alert" className="text-sm text-red-600">{hours.error}</p>}
      {timeState.error && <p role="alert" className="text-sm text-red-600">{timeState.error}</p>}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-indigo-600">{totalHours}h</p>
          <p className="text-xs text-zinc-500 mt-1">Total Hours</p>
        </Card>
        {memberSummary.slice(0, 3).map(({ member, total }) => {
          const user = member.user;
          return (
            <Card key={member.userId} className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Avatar initials={user?.initials ?? '?'} color={user?.avatarColor} size="xs" />
                <p className="text-xs font-medium text-zinc-700  truncate">{user?.name.split(' ')[0]}</p>
              </div>
              <p className="text-lg font-bold text-zinc-800 ">{formatMinutes(total)}</p>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Log Time Form */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-zinc-700  mb-4 flex items-center gap-2">
            <Plus size={14} className="text-indigo-500" /> Log Time
          </h3>
          <form onSubmit={handleLog} className="space-y-3">
            <div>
              <Label htmlFor="time-task">Task</Label>
              <Select
                id="time-task"
                value={taskId}
                onChange={setTaskId}
                options={tasks.map((task) => ({ value: task.id, label: task.title }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="time-minutes">Minutes</Label>
              <Input
                id="time-minutes"
                type="number"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="e.g. 90"
                min="1"
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="time-date">Date</Label>
              <Input id="time-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="time-note">Note</Label>
              <Input id="time-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did you work on?" className="mt-1" />
            </div>
            <Button type="submit" variant="primary" size="sm" loading={loading} className="w-full">Log Time</Button>
          </form>
        </Card>

        {/* Entries List */}
        <div className="lg:col-span-2">
          <h3 className="text-sm font-semibold text-zinc-700  mb-3 flex items-center gap-2">
            <Clock size={14} className="text-indigo-500" /> Time Entries
          </h3>
          {timeState.loading && entries.length === 0 ? (
            <div className="h-20 animate-pulse rounded-xl bg-zinc-100" />
          ) : entries.length === 0 ? (
            <EmptyState icon={<Clock size={36} />} title="No time logged" description="Log time using the form to track hours on this project" />
          ) : (
            <div className="space-y-2">
              {[...entries].reverse().map((entry) => {
                const user = users.find((item) => item.id === entry.userId);
                return (
                  <div key={entry.id} className="flex items-center gap-3 bg-white  border border-zinc-200  rounded-xl px-4 py-3">
                    <Avatar initials={user?.initials ?? '?'} color={user?.avatarColor} size="xs" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-800 ">{entry.note || 'No note'}</p>
                      <p className="text-xs text-zinc-500">{user?.name} · {formatDate(entry.date)}</p>
                    </div>
                    <span className="text-sm font-semibold text-indigo-600  flex-shrink-0">
                      {formatMinutes(entry.minutes)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
