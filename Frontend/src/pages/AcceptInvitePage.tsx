import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { acceptInvite } from '@/api/invites';
import { Button, Input, Label } from '@/components/ui';
import { Briefcase } from 'lucide-react';

export const AcceptInvitePage: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await acceptInvite(token, name, password);
      setAccepted(true);
      setPassword('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Invite could not be accepted');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <Briefcase size={20} className="text-indigo-600" />
          <h1 className="text-xl font-bold text-zinc-900">Join AgencyDesk</h1>
        </div>
        {accepted ? (
          <div>
            <p className="text-sm text-zinc-600 mb-5">Your invitation was accepted. Sign in to continue.</p>
            <Button variant="primary" onClick={() => navigate('/login', { replace: true })}>Go to sign in</Button>
          </div>
        ) : !token ? (
          <p role="alert" className="text-sm text-red-600">The invitation link is missing its token.</p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="invite-name">Full name</Label>
              <Input id="invite-name" value={name} onChange={(event) => setName(event.target.value)} required />
            </div>
            <div>
              <Label htmlFor="invite-password">Create password</Label>
              <Input id="invite-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </div>
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <Button type="submit" variant="primary" loading={loading}>Accept invitation</Button>
          </form>
        )}
      </div>
    </div>
  );
};
