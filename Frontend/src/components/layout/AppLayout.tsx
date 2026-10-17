import React, { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useStore } from '@/store';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { ToastContainer } from './ToastContainer';
import { CommandPalette } from './CommandPalette';
import { TaskDrawer } from '@/features/tasks/TaskDrawer';

export const AppLayout: React.FC = () => {
  const session = useStore((s) => s.session);
  const authReady = useStore((s) => s.authReady);
  const restoreSession = useStore((s) => s.restoreSession);
  const navigate = useNavigate();
  const setCommandPaletteOpen = useStore((s) => s.setCommandPaletteOpen);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    if (authReady && !session) navigate('/login', { replace: true });
  }, [authReady, session, navigate]);

  // 'c' shortcut → new task (handled in board)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setCommandPaletteOpen]);

  if (!authReady || !session) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <Outlet />
        </main>
      </div>
      <CommandPalette />
      <TaskDrawer />
      <ToastContainer />
    </div>
  );
};
