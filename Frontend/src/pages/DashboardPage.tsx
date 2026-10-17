import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useStore, useViewingAs, useCurrentWorkspaceId, useCurrentUser } from '@/store';
import { Card, CardContent, CardHeader, Skeleton, Badge, Avatar, ProgressBar, Button } from '@/components/ui';
import { formatDate, formatDateShort, relativeTime, cn } from '@/lib/utils';
import {
  CheckSquare, Clock, FileText, CalendarClock,
  TrendingUp, Activity, FolderKanban,
} from 'lucide-react';

const GREETING = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

export const DashboardPage: React.FC = () => {
  const viewingAs = useViewingAs();
  const workspaceId = useCurrentWorkspaceId();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const loadDashboard = useStore((s) => s.loadDashboard);
  const loadProjects = useStore((s) => s.loadProjects);
  const loadActivity = useStore((s) => s.loadActivity);
  const dashboard = useStore((s) => s.dashboard);
  const projects = useStore((s) => s.projects);
  const activity = useStore((s) => s.activity).slice(0, 8);
  const activityState = useStore((s) => s.activityState);
  const users = useStore((s) => s.users);

  useEffect(() => {
    void Promise.all([loadDashboard(), loadProjects(), loadActivity()]).catch((error: unknown) => {
      useStore.getState().pushToast({ title: 'Dashboard data could not be loaded', description: error instanceof Error ? error.message : 'Request failed', variant: 'error' });
    });
  }, [workspaceId, loadDashboard, loadProjects, loadActivity]);

  const data = dashboard.data;
  const counts = data?.task_counts ?? { todo: 0, in_progress: 0, in_review: 0, done: 0 };
  const stats = {
    openTasks: counts.todo + counts.in_progress + counts.in_review,
    dueThisWeek: data?.due_this_week ?? 0,
    hoursThisWeek: Math.round(data?.hours_this_week ?? 0),
    filesAwaitingReview: data?.files_awaiting_review ?? 0,
    tasksByStatus: [
      { status: 'Todo', count: counts.todo },
      { status: 'In Progress', count: counts.in_progress },
      { status: 'In Review', count: counts.in_review },
      { status: 'Done', count: counts.done },
    ],
  };
  const projectSummary = new Map((data?.projects ?? []).map((item) => [item.project_id, item]));
  const projectsWithProgress = projects.slice(0, 4).map((project) => {
    const summary = projectSummary.get(project.id);
    const taskCount = summary?.task_count ?? 0;
    return { ...project, taskCount, progress: taskCount ? Math.round((summary?.done_count ?? 0) * 100 / taskCount) : 0 };
  });
  const loading = dashboard.loading;

  if (dashboard.error && !data) {
    return (
      <div role="alert" className="p-6 text-sm text-red-600">
        {dashboard.error}
        <Button variant="secondary" size="sm" className="ml-3" onClick={() => void loadDashboard()}>Retry</Button>
      </div>
    );
  }

  const STAT_CARDS = [
    { label: 'Open Tasks',         value: stats.openTasks,         icon: <CheckSquare size={18} />, color: 'text-indigo-600',  bg: 'bg-indigo-50' },
    { label: 'Due This Week',      value: stats.dueThisWeek,       icon: <CalendarClock size={18} />, color: 'text-orange-600', bg: 'bg-orange-50' },
    ...(viewingAs !== 'client' ? [
      { label: 'Hours This Week',  value: stats.hoursThisWeek,     icon: <Clock size={18} />, color: 'text-blue-600',   bg: 'bg-blue-50' },
    ] : []),
    { label: 'Files Awaiting Review', value: stats.filesAwaitingReview, icon: <FileText size={18} />, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  if (loading || !data) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64 lg:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {activityState.error && <p role="alert" className="text-sm text-red-600">{activityState.error}</p>}
      {/* Greeting */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3">
          <Avatar initials={user?.initials ?? 'U'} color={user?.avatarColor} size="md" />
          <div>
            <h1 className="text-xl font-bold text-zinc-900">
              {GREETING()}, {user?.name.split(' ')[0]}! 👋
            </h1>
            <p className="text-sm text-zinc-500">{formatDate(new Date().toISOString())}</p>
          </div>
        </div>
      </motion.div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
          >
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="flex items-center gap-4">
                <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center', card.bg)}>
                  <span className={card.color}>{card.icon}</span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-zinc-900">{card.value}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{card.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Chart + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <motion.div
          className="lg:col-span-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-indigo-500" />
                <h2 className="font-semibold text-zinc-800 text-sm">Tasks by Status</h2>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats.tasksByStatus} barSize={32}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-zinc-100" />
                  <XAxis dataKey="status" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid #e4e4e7',
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Activity */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-indigo-500" />
                <h2 className="font-semibold text-zinc-800 text-sm">Recent Activity</h2>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-zinc-100">
                {activity.length === 0 && (
                  <p className="text-sm text-zinc-400 text-center py-6">No activity yet</p>
                )}
                {activity.map((entry) => {
                  const actor = users.find((item) => item.id === entry.actorId);
                  return (
                    <div key={entry.id} className="flex items-start gap-3 px-4 py-3">
                      <Avatar initials={actor?.initials ?? '?'} color={actor?.avatarColor} size="xs" className="mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-zinc-600 leading-tight">
                          <span className="font-medium text-zinc-800">{actor?.name ?? entry.meta.actor_name}</span>{' '}
                          {activityLabel(entry.type, entry.meta)}
                        </p>
                        <p className="text-[10px] text-zinc-400 mt-0.5">{relativeTime(entry.createdAt)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Projects Overview */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FolderKanban size={16} className="text-indigo-500" />
              <h2 className="font-semibold text-zinc-800 text-sm">Projects Overview</h2>
            </div>
          </CardHeader>
          <div className="divide-y divide-zinc-100">
            {projectsWithProgress.map((p) => (
              <div
                key={p.id}
                className="px-4 py-3 hover:bg-zinc-50 cursor-pointer transition-colors"
                onClick={() => navigate(`/projects/${p.id}`)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-zinc-800">{p.name}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{p.taskCount} tasks · Due {formatDateShort(p.dueDate)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-zinc-700">{p.progress}%</span>
                    <Badge variant={p.status === 'active' ? 'green' : p.status === 'on_hold' ? 'yellow' : 'zinc'} className="capitalize">
                      {p.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
                <ProgressBar value={p.progress} />
              </div>
            ))}
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

function activityLabel(type: string, meta: Record<string, string>): string {
  switch (type) {
    case 'task_created':           return 'created a task';
    case 'task_moved':             return 'updated a task status';
    case 'task_updated':           return 'updated a task';
    case 'task_assigned':          return `assigned a task`;
    case 'comment_added':          return 'added a comment';
    case 'file_uploaded':          return 'uploaded a file';
    case 'file_approved':          return 'approved a file';
    case 'file_changes_requested': return 'requested changes on a file';
    case 'member_joined':          return `joined the workspace`;
    case 'member_removed':         return `removed a team member`;
    case 'project_created':        return 'created a project';
    case 'project_members_added':  return 'added project members';
    case 'time_logged':            return 'logged time';
    case 'invite_created':         return `created an invite for ${meta.email ?? 'a new member'}`;
    case 'invite_resent':          return `resent an invite to ${meta.email ?? 'a member'}`;
    case 'invite_revoked':         return `revoked an invite for ${meta.email ?? 'a member'}`;
    default:                       return type;
  }
}
