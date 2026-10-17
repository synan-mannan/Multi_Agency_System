import React from 'react';
import { useStore, useCurrentWorkspaceId, useViewingAs } from '@/store';
import { mapWorkspace, roleFromApi } from '@/api/mappers';
import {
  Avatar, Badge, Dropdown, DropdownTrigger, DropdownContent,
  DropdownItem, DropdownSeparator, Tooltip,
} from '@/components/ui';
import {
  Search, ChevronDown, LogOut, Settings, ChevronRight, Briefcase,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Persona } from '@/types';

// ─── Workspace Switcher ───────────────────────────────────────────────────────

function WorkspaceSwitcher() {
  const workspaceId = useCurrentWorkspaceId();
  const switchWorkspace = useStore((s) => s.switchWorkspace);
  const pushToast = useStore((s) => s.pushToast);
  const choices = useStore((s) => s.workspaces);
  const session = useStore((s) => s.session);
  const workspace = session ? {
    id: session.workspaceId,
    name: session.agencyName,
    logoInitials: session.agencyName.split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase(),
    color: '#6366f1',
  } : undefined;

  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-100 transition-colors">
          <div
            className="h-6 w-6 rounded-md flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
            style={{ backgroundColor: workspace?.color }}
          >
            {workspace?.logoInitials}
          </div>
          <span className="text-sm font-semibold text-zinc-900 hidden sm:block">
            {workspace?.name}
          </span>
          <ChevronDown size={14} className="text-zinc-400" />
        </button>
      </DropdownTrigger>
      <DropdownContent align="start">
        <p className="px-2.5 py-1 text-xs font-medium text-zinc-400 uppercase tracking-wider">Workspaces</p>
        {choices.map((choice) => {
          const ws = mapWorkspace(choice);
          return (
            <DropdownItem
              key={choice.membership_id}
              onClick={() => {
                void switchWorkspace(ws.id).then(() => {
                  pushToast({ title: `Switched to ${ws.name}`, variant: 'success' });
                }).catch((error: unknown) => {
                  pushToast({ title: 'Workspace switch failed', description: error instanceof Error ? error.message : 'Try signing in again', variant: 'error' });
                });
              }}
            >
              <div
                className="h-5 w-5 rounded flex items-center justify-center text-white text-[9px] font-bold"
                style={{ backgroundColor: ws.color }}
              >
                {ws.logoInitials}
              </div>
              <span className="flex-1">{ws.name}</span>
              <Badge variant="zinc" className="capitalize text-[10px]">{roleFromApi(choice.role)}</Badge>
              {ws.id === workspaceId && <ChevronRight size={12} className="text-indigo-500" />}
            </DropdownItem>
          );
        })}
      </DropdownContent>
    </Dropdown>
  );
}

// ─── Persona Switcher ─────────────────────────────────────────────────────────

const PERSONAS: { value: Persona; label: string; color: 'indigo' | 'blue' | 'green' }[] = [
  { value: 'admin',  label: 'Agency Admin',  color: 'indigo' },
  { value: 'member', label: 'Agency Member', color: 'blue' },
  { value: 'client', label: 'Client User',   color: 'green' },
];

function PersonaSwitcher() {
  const viewingAs = useViewingAs();
  const setViewingAs = useStore((s) => s.setViewingAs);
  const pushToast = useStore((s) => s.pushToast);
  const current = PERSONAS.find((p) => p.value === viewingAs);

  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <button className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium border border-zinc-200 hover:bg-zinc-50 transition-colors text-zinc-600">
          <span className="text-zinc-400">UI preview only</span>
          <Badge variant={current?.color ?? 'zinc'} className="text-[10px]">{current?.label}</Badge>
          <ChevronDown size={12} className="text-zinc-400" />
        </button>
      </DropdownTrigger>
      <DropdownContent>
        <p className="px-2.5 py-1 text-xs font-medium text-zinc-400 uppercase tracking-wider">UI preview only</p>
        {PERSONAS.map((p) => (
          <DropdownItem
            key={p.value}
            onClick={() => {
              setViewingAs(p.value);
              pushToast({ title: `Now viewing as ${p.label}`, variant: 'default' });
            }}
          >
            <Badge variant={p.color} className="text-[10px]">{p.label}</Badge>
            {p.value === viewingAs && <span className="ml-auto text-indigo-500">✓</span>}
          </DropdownItem>
        ))}
      </DropdownContent>
    </Dropdown>
  );
}

// ─── User Menu ────────────────────────────────────────────────────────────────

function UserMenu() {
  const logout = useStore((s) => s.logout);
  const session = useStore((s) => s.session);
  const navigate = useNavigate();
  const user = session?.user;
  if (!user) return null;

  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <button className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
          <Avatar initials={user.initials} color={user.avatarColor} size="sm" title={user.name} />
        </button>
      </DropdownTrigger>
      <DropdownContent align="end">
        <div className="px-2.5 py-2">
          <p className="text-sm font-medium text-zinc-900">{user.name}</p>
          <p className="text-xs text-zinc-500">{user.email}</p>
        </div>
        <DropdownSeparator className="h-px bg-zinc-100 my-1" />
        <DropdownItem onClick={() => navigate('/settings')}>
          <Settings size={14} /> Settings
        </DropdownItem>
        <DropdownSeparator className="h-px bg-zinc-100 my-1" />
        <DropdownItem
          danger
          onClick={() => { logout(); navigate('/login'); }}
        >
          <LogOut size={14} /> Sign out
        </DropdownItem>
      </DropdownContent>
    </Dropdown>
  );
}

// ─── Main TopBar ──────────────────────────────────────────────────────────────

export const TopBar: React.FC = () => {
  const setCommandPaletteOpen = useStore((s) => s.setCommandPaletteOpen);
  const viewingAs = useViewingAs();

  return (
    <header className="h-14 flex items-center px-4 border-b border-zinc-200 bg-white/80 backdrop-blur-sm sticky top-0 z-30 gap-3">
      <WorkspaceSwitcher />

      <div className="flex-1" />

      {/* Search */}
      <Tooltip content="Search   ⌘K">
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="hidden md:flex items-center gap-2 px-3 h-8 rounded-lg border border-zinc-200 text-sm text-zinc-400 hover:text-zinc-600 hover:border-zinc-300 transition-colors bg-zinc-50"
        >
          <Search size={13} />
          <span className="text-xs">Search…</span>
          <kbd className="ml-2 text-[10px] border border-zinc-200 rounded px-1 py-0.5 text-zinc-400">⌘K</kbd>
        </button>
      </Tooltip>

      {/* Persona Switcher */}
      {import.meta.env.DEV && <PersonaSwitcher />}

      {/* Client Portal Badge */}
      {viewingAs === 'client' && (
        <Badge variant="green" className="hidden sm:flex gap-1">
          <Briefcase size={10} /> Client Portal
        </Badge>
      )}

      <UserMenu />
    </header>
  );
};
