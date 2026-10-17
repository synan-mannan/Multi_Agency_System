import React, { useEffect } from 'react';
import { useViewingAs, useCurrentWorkspaceId, useStore } from '@/store';
import { Card, Badge, EmptyState } from '@/components/ui';
import { Skeleton } from '@/components/ui';
import { Building2, FolderKanban, Mail, User } from 'lucide-react';

export const ClientsPage: React.FC = () => {
  const viewingAs = useViewingAs();
  const workspaceId = useCurrentWorkspaceId();
  const loadClients = useStore((s) => s.loadClients);
  const loadProjects = useStore((s) => s.loadProjects);
  const clientState = useStore((s) => s.clientState);
  const projectState = useStore((s) => s.projectState);
  const clients = useStore((s) => s.clients);
  const projects = useStore((s) => s.projects);

  useEffect(() => {
    void Promise.all([loadClients(), loadProjects()]).catch((error: unknown) => {
      useStore.getState().pushToast({ title: 'Clients could not be loaded', description: error instanceof Error ? error.message : 'Request failed', variant: 'error' });
    });
  }, [workspaceId, loadClients, loadProjects]);
  const loading = clientState.loading || projectState.loading;

  if (viewingAs !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <Building2 size={48} className="text-zinc-300 mb-4" />
        <h2 className="text-lg font-semibold text-zinc-700 ">Not found</h2>
        <p className="text-sm text-zinc-500">This page doesn't exist.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-zinc-900 ">Clients</h1>
        <p className="text-sm text-zinc-500 mt-0.5">{clients.length} client organization{clients.length !== 1 ? 's' : ''}</p>
      </div>

      {(clientState.error || projectState.error) && (
        <p role="alert" className="mb-4 text-sm text-red-600">{clientState.error ?? projectState.error}</p>
      )}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : clients.length === 0 ? (
        <EmptyState icon={<Building2 size={48} />} title="No clients yet" description="Add client organizations to get started" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((client) => {
            const clientProjects = projects.filter((p) => p.clientOrgId === client.id);
            return (
              <Card key={client.id} className="p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="h-10 w-10 rounded-xl bg-indigo-100  flex items-center justify-center">
                    <Building2 size={20} className="text-indigo-600 " />
                  </div>
                  <Badge variant="zinc" className="text-[10px]">{clientProjects.length} project{clientProjects.length !== 1 ? 's' : ''}</Badge>
                </div>
                <h3 className="font-semibold text-zinc-900  mb-1">{client.name}</h3>
                <div className="space-y-1.5 text-sm text-zinc-500">
                  <div className="flex items-center gap-2">
                    <User size={13} className="flex-shrink-0" />
                    <span>{client.contactName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail size={13} className="flex-shrink-0" />
                    <a href={`mailto:${client.contactEmail}`} className="text-indigo-600 hover:underline truncate">{client.contactEmail}</a>
                  </div>
                </div>
                {clientProjects.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-zinc-100  space-y-1.5">
                    {clientProjects.map((p) => (
                      <div key={p.id} className="flex items-center gap-2 text-xs text-zinc-600 ">
                        <FolderKanban size={11} className="text-indigo-400 flex-shrink-0" />
                        <span className="truncate">{p.name}</span>
                        <Badge
                          variant={p.status === 'active' ? 'green' : p.status === 'on_hold' ? 'yellow' : 'zinc'}
                          className="ml-auto text-[9px] flex-shrink-0 capitalize"
                        >
                          {p.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
