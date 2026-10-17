import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ProjectsPage } from '@/pages/ProjectsPage';
import { ProjectDetailPage } from '@/pages/ProjectDetailPage';
import { ClientsPage } from '@/pages/ClientsPage';
import { TeamPage } from '@/pages/TeamPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { AcceptInvitePage } from '@/pages/AcceptInvitePage';
import { useStore, useViewingAs } from '@/store';
import type { ReactNode } from 'react';

function AdminOnly({ children }: { children: ReactNode }) {
  const session = useStore((state) => state.session);
  const persona = useViewingAs();
  if (!session) return null;
  return persona === 'admin' ? children : <NotFoundPage />;
}

function App() {
  return (
    <TooltipProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/invite/accept" element={<AcceptInvitePage />} />
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
            <Route path="/clients" element={<AdminOnly><ClientsPage /></AdminOnly>} />
            <Route path="/team" element={<AdminOnly><TeamPage /></AdminOnly>} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  );
}

export default App;
