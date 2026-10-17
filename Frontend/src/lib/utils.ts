import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Priority, TaskStatus, FileReviewStatus } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function parseDate(iso: string): Date {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!dateOnly) return new Date(iso);
  return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
}

export function formatDate(iso: string): string {
  return parseDate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateShort(iso: string): string {
  return parseDate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function isOverdue(iso: string | null): boolean {
  if (!iso) return false;
  return new Date(iso) < new Date();
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDateShort(iso);
}

export const priorityConfig: Record<Priority, { label: string; color: string; dot: string }> = {
  urgent: { label: 'Urgent', color: 'text-red-600',    dot: 'bg-red-500' },
  high:   { label: 'High',   color: 'text-orange-600', dot: 'bg-orange-500' },
  medium: { label: 'Medium', color: 'text-yellow-600', dot: 'bg-yellow-500' },
  low:    { label: 'Low',    color: 'text-zinc-400',   dot: 'bg-zinc-400' },
};

export const statusConfig: Record<TaskStatus, { label: string; color: string; bg: string }> = {
  todo:        { label: 'Todo',        color: 'text-zinc-500',   bg: 'bg-zinc-100' },
  in_progress: { label: 'In Progress', color: 'text-blue-600',   bg: 'bg-blue-50' },
  in_review:   { label: 'In Review',   color: 'text-purple-600', bg: 'bg-purple-50' },
  done:        { label: 'Done',        color: 'text-green-600',  bg: 'bg-green-50' },
};

export const reviewConfig: Record<FileReviewStatus, { label: string; color: string }> = {
  pending:           { label: 'Pending',           color: 'text-yellow-700 bg-yellow-100' },
  approved:          { label: 'Approved',          color: 'text-green-700 bg-green-100' },
  changes_requested: { label: 'Changes Requested', color: 'text-red-700 bg-red-100' },
};

export function formatMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h === 0) return `${min}m`;
  if (min === 0) return `${h}h`;
  return `${h}h ${min}m`;
}

export function projectProgress(tasks: { status: string }[]): number {
  if (!tasks.length) return 0;
  const done = tasks.filter((t) => t.status === 'done').length;
  return Math.round((done / tasks.length) * 100);
}
