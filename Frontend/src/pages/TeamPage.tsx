import React, { useState, useEffect } from 'react';
import { useStore, useViewingAs, useCurrentWorkspaceId, useCurrentUserId } from '@/store';
import {
  Card, Badge, Button, Avatar, Dialog, DialogContent, DialogHeader, DialogTitle,
  Input, Label, Select, EmptyState, Skeleton,
} from '@/components/ui';
import { formatDate } from '@/lib/utils';
import { Users, Plus, Mail, RefreshCw, Trash2, AlertCircle, X } from 'lucide-react';
import type { Invite, Role } from '@/types';

// ─── Invite Dialog ─────────────────────────────────────────────────────────────

function InviteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const workspaceId = useCurrentWorkspaceId();
  const addInvite = useStore((s) => s.addInvite);
  const pushToast = useStore((s) => s.pushToast);
  const allClients = useStore((s) => s.clients);
  const clients = allClients.filter((client) => client.workspaceId === workspaceId);

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('member');
  const [clientOrgId, setClientOrgId] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { token } = await addInvite({
        id: '',
        workspaceId,
        email,
        role,
        clientOrgId: role === 'client' ? clientOrgId : undefined,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
      pushToast({
        title: `Invite created for ${email}`,
        description: `${window.location.origin}/invite/accept?token=${encodeURIComponent(token)}`,
        variant: 'success',
      });
      setEmail(''); setRole('member'); setClientOrgId('');
      onClose();
    } catch (error) {
      pushToast({ title: 'Invite could not be sent', description: error instanceof Error ? error.message : 'Request failed', variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-zinc-900 ">Invite Member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="inv-email">Email</Label>
            <Input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="colleague@agency.com" required className="mt-1" />
          </div>
          <div>
            <Label htmlFor="inv-role">Role</Label>
            <Select
              id="inv-role"
              value={role}
              onChange={(v) => setRole(v as Role)}
              options={[
                { value: 'member', label: 'Agency Member' },
                { value: 'admin', label: 'Agency Admin' },
                { value: 'client', label: 'Client User' },
              ]}
              className="mt-1"
            />
          </div>
          {role === 'client' && (
            <div>
              <Label htmlFor="inv-client">Client Organization</Label>
              <Select
                id="inv-client"
                value={clientOrgId}
                onChange={setClientOrgId}
                options={[{ value: '', label: 'Select client…' }, ...clients.map((c) => ({ value: c.id, label: c.name }))]}
                className="mt-1"
              />
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" className="flex-1" loading={loading}>Send Invite</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Remove Member Dialog ─────────────────────────────────────────────────────

function RemoveMemberDialog({ userId: targetId, name, open, onClose }: {
  userId: string; name: string; open: boolean; onClose: () => void;
}) {
  const removeMember = useStore((s) => s.removeMember);
  const pushToast = useStore((s) => s.pushToast);
  const [loading, setLoading] = useState(false);

  const handleRemove = async () => {
    setLoading(true);
    try {
      await removeMember(targetId);
      pushToast({ title: `${name} removed from workspace`, variant: 'default' });
      onClose();
    } catch (error) {
      pushToast({ title: 'Member could not be removed', description: error instanceof Error ? error.message : 'Request failed', variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-zinc-900 ">Remove {name}?</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-3 bg-red-50  border border-red-200  rounded-xl p-3">
            <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 ">
              This will remove {name} from the workspace and unassign them from all tasks. This action cannot be undone.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button variant="danger" className="flex-1" loading={loading} onClick={handleRemove}>Remove Member</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Team Page ─────────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<Role, 'indigo' | 'blue' | 'green'> = {
  admin: 'indigo', member: 'blue', client: 'green',
};

export const TeamPage: React.FC = () => {
  const viewingAs = useViewingAs();
  const workspaceId = useCurrentWorkspaceId();
  const currentUserId = useCurrentUserId();
  const pushToast = useStore((s) => s.pushToast);
  const allInvites = useStore((s) => s.invites);
  const allMembers = useStore((s) => s.members);
  const users = useStore((s) => s.users);
  const inviteState = useStore((s) => s.inviteState);
  const teamState = useStore((s) => s.teamState);
  const loadInvites = useStore((s) => s.loadInvites);
  const loadTeam = useStore((s) => s.loadTeam);
  const loadClients = useStore((s) => s.loadClients);
  const loadProjects = useStore((s) => s.loadProjects);
  const resendInvite = useStore((s) => s.resendInvite);
  const revokeInvite = useStore((s) => s.revokeInvite);

  const [loading, setLoading] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);
  const [resendingIds, setResendingIds] = useState<string[]>([]);

  useEffect(() => {
    setLoading(true);
    void Promise.all([loadTeam(), loadInvites(), loadClients(), loadProjects()])
      .catch((error: unknown) => pushToast({
        title: 'Team data could not be loaded',
        description: error instanceof Error ? error.message : 'Request failed',
        variant: 'error',
      }))
      .finally(() => setLoading(false));
  }, [workspaceId, loadTeam, loadInvites, loadClients, loadProjects, pushToast]);

  if (viewingAs !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <Users size={48} className="text-zinc-300 mb-4" />
        <h2 className="text-lg font-semibold text-zinc-700 ">Not found</h2>
      </div>
    );
  }

  const members = allMembers.filter((member) => member.workspaceId === workspaceId && member.status === 'active');
  const invites = allInvites.filter(
    (i) => i.workspaceId === workspaceId && i.status === 'pending',
  );

  const handleResend = async (invite: Invite) => {
    if (resendingIds.includes(invite.id)) return;
    setResendingIds((ids) => [...ids, invite.id]);
    try {
      const token = await resendInvite(invite.id);
      pushToast({
        title: `Invite renewed for ${invite.email}`,
        description: `${window.location.origin}/invite/accept?token=${encodeURIComponent(token)}`,
        variant: 'success',
      });
    } catch (error) {
      pushToast({ title: 'Invite could not be resent', description: error instanceof Error ? error.message : 'Request failed', variant: 'error' });
    } finally {
      setResendingIds((ids) => ids.filter((id) => id !== invite.id));
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 ">Team</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{members.length} member{members.length !== 1 ? 's' : ''}</p>
        </div>
        <Button variant="primary" onClick={() => setInviteOpen(true)}>
          <Plus size={15} /> Invite Member
        </Button>
      </div>

      {/* Members Table */}
      {(teamState.error || inviteState.error) && (
        <p role="alert" className="text-sm text-red-600">{teamState.error ?? inviteState.error}</p>
      )}
      <Card>
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-100  text-left">
              {['Member', 'Role', 'Joined', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 ">
            {members.length === 0 ? (
              <tr><td colSpan={4}><EmptyState icon={<Users size={36} />} title="No team members yet" description="Invite a team member to collaborate in this workspace" /></td></tr>
            ) : members.map((m) => {
              const user = m.user ?? users.find((item) => item.id === m.userId);
              const isSelf = m.userId === currentUserId;
              return (
                <tr key={m.userId} className="hover:bg-zinc-50  transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar initials={user?.initials ?? '?'} color={user?.avatarColor} size="sm" />
                      <div>
                        <p className="text-sm font-medium text-zinc-800 ">
                          {user?.name ?? m.userId} {isSelf && <span className="text-zinc-400 text-xs">(you)</span>}
                        </p>
                        <p className="text-xs text-zinc-500">{user?.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={ROLE_COLORS[m.role]} className="capitalize">{m.role}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">{formatDate(m.joinedAt)}</td>
                  <td className="px-4 py-3">
                    {!isSelf && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRemoveTarget({ id: m.userId, name: user?.name ?? m.userId })}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 size={13} /> Remove
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {/* Pending Invites */}
      {invites.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-zinc-700  mb-3">Pending Invites</h2>
          <Card>
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-100  text-left">
                  {['Email', 'Role', 'Sent', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 ">
                {invites.map((invite) => (
                  <tr key={invite.id} className="hover:bg-zinc-50  transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Mail size={13} className="text-zinc-400 flex-shrink-0" />
                        <span className="text-sm text-zinc-700 ">{invite.email}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={ROLE_COLORS[invite.role] ?? 'zinc'} className="capitalize">{invite.role}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">{formatDate(invite.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          loading={resendingIds.includes(invite.id)}
                          onClick={() => handleResend(invite)}
                        >
                          <RefreshCw size={12} /> Resend
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => { void revokeInvite(invite.id).then(() => pushToast({ title: `Invite to ${invite.email} revoked` })).catch((error: unknown) => pushToast({ title: 'Invite could not be revoked', description: error instanceof Error ? error.message : 'Request failed', variant: 'error' })); }}
                        >
                          <X size={12} /> Revoke
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} />
      {removeTarget && (
        <RemoveMemberDialog
          userId={removeTarget.id}
          name={removeTarget.name}
          open
          onClose={() => setRemoveTarget(null)}
        />
      )}
    </div>
  );
};
