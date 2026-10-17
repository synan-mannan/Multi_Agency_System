import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore, useViewingAs } from '@/store';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Settings,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react';
import { Button, Tooltip } from '@/components/ui';
import type { Persona } from '@/types';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  roles: Persona[];
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: <LayoutDashboard size={18} />, roles: ['admin', 'member', 'client'] },
  { to: '/projects', label: 'Projects', icon: <FolderKanban size={18} />, roles: ['admin', 'member', 'client'] },
  { to: '/clients', label: 'Clients', icon: <UserCheck size={18} />, roles: ['admin'] },
  { to: '/team', label: 'Team', icon: <Users size={18} />, roles: ['admin'] },
  { to: '/settings', label: 'Settings', icon: <Settings size={18} />, roles: ['admin', 'member', 'client'] },
];

export const Sidebar: React.FC = () => {
  const collapsed = useStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useStore((s) => s.setSidebarCollapsed);
  const viewingAs = useViewingAs();
  const navigate = useNavigate();
  const location = useLocation();
  const pushToast = useStore((s) => s.pushToast);

  const visibleNav = NAV_ITEMS.filter((item) => item.roles.includes(viewingAs));

  return (
    <motion.aside
      animate={{ width: collapsed ? 60 : 220 }}
      transition={{ type: 'spring', stiffness: 400, damping: 35 }}
      className={cn(
        'flex h-full min-w-0 flex-col flex-shrink-0',
        'overflow-hidden bg-white',
        'border-r border-zinc-200',
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          'flex h-14 flex-shrink-0 items-center',
          'border-b border-zinc-200',
          collapsed ? 'justify-center px-2' : 'px-3',
        )}
      >
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-sm">
          <span className="text-xs font-bold text-white">A</span>
        </div>

        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="ml-2.5 whitespace-nowrap text-sm font-bold text-zinc-900"
            >
              AgencyDesk
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="min-w-0 flex-1 space-y-0.5 overflow-x-hidden overflow-y-auto px-2 py-3 scrollbar-thin">
        {visibleNav.map((item) => {
          const link = (
            <NavLink
              to={item.to}
              end={item.to === '/'}
              aria-label={item.label}
              className={cn(
                // layout: always one row
                'group flex w-full min-w-0 flex-row flex-nowrap items-center',
                'gap-3 rounded-lg py-2 text-sm font-medium whitespace-nowrap',
                'transition-colors duration-150',
                collapsed ? 'justify-center px-0' : 'px-2.5',
                // inactive
                'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
                // active (React Router sets aria-current="page")
                'aria-[current=page]:bg-indigo-50 aria-[current=page]:text-indigo-700',
              )}
            >
              <span className="flex flex-shrink-0 items-center justify-center">
                {item.icon}
              </span>

              <AnimatePresence initial={false}>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.1 }}
                    className="min-w-0 flex-1 truncate whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </NavLink>
          );

          // Tooltip only when collapsed; wrapped in a div so it never touches NavLink's props
          return collapsed ? (
            <Tooltip key={item.to} content={item.label} side="right">
              <div>{link}</div>
            </Tooltip>
          ) : (
            <div key={item.to}>{link}</div>
          );
        })}
      </nav>

      {/* New Task shortcut */}
      {viewingAs !== 'client' && !collapsed && (
        <div className="flex-shrink-0 px-3 pb-3">
          <Button
            variant="primary"
            size="sm"
            className="w-full whitespace-nowrap"
            onClick={() => {
              const projectMatch = location.pathname.match(/^\/projects\/([^/]+)\/?$/);
              if (projectMatch) {
                window.dispatchEvent(new Event('agencydesk:create-task'));
              } else {
                navigate('/projects');
                pushToast({ title: 'Open a project to create a task', variant: 'default' });
              }
            }}
          >
            <Plus size={14} />
            New Task
          </Button>
        </div>
      )}

      {/* Collapse toggle */}
      <button
        type="button"
        onClick={() => setSidebarCollapsed(!collapsed)}
        className={cn(
          'flex h-10 flex-shrink-0 items-center justify-center',
          'border-t border-zinc-200 text-zinc-400 transition-colors',
          'hover:bg-zinc-50 hover:text-zinc-600',
        )}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </motion.aside>
  );
};