import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/store';
import { mapWorkspace, roleFromApi } from '@/api/mappers';
import { Button, Input, Label, Badge } from '@/components/ui';
import { Lock, Mail, Building2, ChevronRight, Briefcase, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

type Mode = 'staff' | 'client';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const login = useStore((s) => s.login);
  const selectWorkspace = useStore((s) => s.selectWorkspace);
  const workspaces = useStore((s) => s.workspaces);
  const session = useStore((s) => s.session);

  const [step, setStep] = useState<1 | 2>(1);
  const [mode, setMode] = useState<Mode>('staff');
  const [email, setEmail] = useState('admin.alpha@agencydesk.test');
  const [password, setPassword] = useState('AgencyDesk123!');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password, mode === 'client');
      setStep(2);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleWorkspaceSelect = async (membershipId: string) => {
    setError('');
    setLoading(true);
    try {
      await selectWorkspace(membershipId);
      navigate('/', { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to select workspace');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (session) navigate('/', { replace: true });
  }, [session, navigate]);

  const roleColors: Record<string, 'indigo' | 'blue' | 'green'> = {
    admin: 'indigo', member: 'blue', client: 'green',
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-zinc-50 to-zinc-100">
      {/* Left panel */}
      <div className="hidden lg:flex lg:flex-1 items-center justify-center p-12 bg-gradient-to-br from-indigo-600 to-indigo-800 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`, backgroundSize: `32px 32px` }} />
        <div className="relative z-10 text-white max-w-sm">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Briefcase size={20} className="text-white" />
            </div>
            <span className="text-2xl font-bold">AgencyDesk</span>
          </div>
          <h1 className="text-4xl font-bold mb-4 leading-tight">
            Your agency,<br />one dashboard.
          </h1>
          <p className="text-indigo-200 text-lg leading-relaxed mb-8">
            Manage projects, clients, and your team — with a client portal built right in.
          </p>
          <div className="space-y-3">
            {[
              { icon: <Building2 size={16} />, text: 'Multi-tenant workspace switching' },
              { icon: <Users size={16} />, text: 'Client portal with visibility controls' },
              { icon: <ChevronRight size={16} />, text: 'Kanban, timeline, files & time tracking' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-indigo-100">
                <div className="h-7 w-7 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">{item.icon}</div>
                <span className="text-sm">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <span className="text-white text-sm font-bold">A</span>
            </div>
            <span className="text-lg font-bold text-zinc-900">AgencyDesk</span>
          </div>

          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-zinc-900">Welcome back</h2>
                  <p className="text-zinc-500 mt-1">Sign in to your AgencyDesk account</p>
                </div>

                {/* Mode toggle */}
                <div className="flex rounded-lg border border-zinc-200 p-1 mb-6 bg-zinc-50">
                  {(['staff', 'client'] as Mode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all',
                        mode === m
                          ? 'bg-white text-zinc-900 shadow-sm'
                          : 'text-zinc-500 hover:text-zinc-700',
                      )}
                    >
                      {m === 'staff' ? <Users size={14} /> : <Briefcase size={14} />}
                      {m === 'staff' ? 'Agency Staff' : 'Client Portal'}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleStep1} className="space-y-4">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <div className="relative mt-1">
                      <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-9"
                        placeholder="you@agency.com"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="password">Password</Label>
                    <div className="relative mt-1">
                      <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-9"
                        placeholder="••••••••"
                        required
                      />
                    </div>
                  </div>
                  {error && <p className="text-sm text-red-600">{error}</p>}
                  <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full mt-2">
                    Continue <ChevronRight size={16} />
                  </Button>
                </form>

                <p className="mt-5 text-xs text-zinc-400 text-center">
                  Demo: <code className="text-indigo-500">admin.alpha@agencydesk.test</code> / <code className="text-indigo-500">AgencyDesk123!</code>
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="mb-6">
                  <button onClick={() => setStep(1)} className="text-sm text-zinc-400 hover:text-zinc-600 mb-3 flex items-center gap-1">
                    ← Back
                  </button>
                  <h2 className="text-2xl font-bold text-zinc-900">Choose a workspace</h2>
                  <p className="text-zinc-500 mt-1">Select which workspace you'd like to enter</p>
                </div>

                <div className="space-y-3">
                  {workspaces.length > 0 ? (
                    workspaces.map((membership) => {
                      const ws = mapWorkspace(membership);
                      const role = roleFromApi(membership.role);
                      return (
                        <button
                          key={membership.membership_id}
                          onClick={() => void handleWorkspaceSelect(membership.membership_id)}
                          disabled={loading}
                          className="w-full flex items-center gap-4 p-4 rounded-xl border border-zinc-200 bg-white hover:border-indigo-300 hover:shadow-md transition-all text-left group"
                        >
                          <div
                            className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                            style={{ backgroundColor: ws.color }}
                          >
                            {ws.logoInitials}
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-zinc-900">{ws.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant={roleColors[role] ?? 'zinc'} className="capitalize">{role}</Badge>
                            </div>
                          </div>
                          <ChevronRight size={16} className="text-zinc-300 group-hover:text-indigo-500 transition-colors" />
                        </button>
                      );
                    })
                  ) : <p className="text-sm text-zinc-500">No workspaces are available for this account.</p>}
                  {error && <p className="text-sm text-red-600">{error}</p>}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
