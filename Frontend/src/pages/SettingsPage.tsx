import React, { useState } from 'react';
import { useStore, useViewingAs } from '@/store';
import { Card, CardContent, CardHeader, Button, Input, Label, Separator, Avatar } from '@/components/ui';
import { Settings, User, Building2 } from 'lucide-react';
import type { AuthSession } from '@/types';

export const SettingsPage: React.FC = () => {
  const session = useStore((s) => s.session);
  return <SettingsForm key={session?.workspaceId ?? 'signed-out'} session={session} />;
};

const SettingsForm: React.FC<{ session: AuthSession | null }> = ({ session }) => {
  const viewingAs = useViewingAs();
  const pushToast = useStore((s) => s.pushToast);
  const updateProfile = useStore((s) => s.updateProfile);
  const updateAgency = useStore((s) => s.updateAgency);

  const user = session?.user;

  const [profileName, setProfileName] = useState(user?.name ?? '');
  const [agencyName, setAgencyName] = useState(session?.agencyName ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingAgency, setSavingAgency] = useState(false);

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      await updateProfile(profileName);
      pushToast({ title: 'Profile saved', variant: 'success' });
    } catch (error) {
      pushToast({ title: 'Profile could not be saved', description: error instanceof Error ? error.message : 'Request failed', variant: 'error' });
    } finally {
      setSavingProfile(false);
    }
  };
  const saveAgency = async () => {
    setSavingAgency(true);
    try {
      await updateAgency(agencyName);
      pushToast({ title: 'Agency settings saved', variant: 'success' });
    } catch (error) {
      pushToast({ title: 'Agency settings could not be saved', description: error instanceof Error ? error.message : 'Request failed', variant: 'error' });
    } finally {
      setSavingAgency(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
          <Settings size={20} className="text-indigo-500" /> Settings
        </h1>
        <p className="text-sm text-zinc-500 mt-0.5">Manage your profile and workspace settings</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User size={15} className="text-indigo-500" />
            <h2 className="text-sm font-semibold text-zinc-800">Profile</h2>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar initials={user?.initials ?? 'U'} color={user?.avatarColor} size="lg" />
            <div>
              <p className="text-sm font-medium text-zinc-800">{user?.name}</p>
              <p className="text-xs text-zinc-500">{user?.email}</p>
            </div>
          </div>
          <Separator />
          <div>
            <Label htmlFor="s-name">Display Name</Label>
            <Input id="s-name" value={profileName} onChange={(e) => setProfileName(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="s-email">Email</Label>
            <Input id="s-email" value={user?.email ?? ''} disabled className="mt-1 opacity-60" />
          </div>
          <Button variant="primary" size="sm" onClick={saveProfile} loading={savingProfile}>Save Profile</Button>
        </CardContent>
      </Card>

      {/* Agency */}
      {viewingAs === 'admin' && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 size={15} className="text-indigo-500" />
              <h2 className="text-sm font-semibold text-zinc-800">Agency</h2>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="s-agency">Agency Name</Label>
              <Input id="s-agency" value={agencyName} onChange={(e) => setAgencyName(e.target.value)} className="mt-1" />
            </div>
            <Button variant="primary" size="sm" onClick={saveAgency} loading={savingAgency}>Save Agency</Button>
          </CardContent>
        </Card>
      )}

    </div>
  );
};
