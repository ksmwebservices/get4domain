'use client';

import { useEffect, useState } from 'react';
import { UserPlus, Loader2, X, Pencil, Trash2, Mail, Phone } from 'lucide-react';
import Button from '@/components/ui/Button';
import { api } from '@/lib/api';

interface TeamMember {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  modules: string[];
  status: string;
  lastLogin: string | null;
}

const MODULES = ['CRM', 'TeleCRM', 'Campaigns', 'Wallet', 'Reports', 'My Page'];

const formatLastActive = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Never logged in';

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', phone: '', role: '', modules: [] as string[] });
  const [inviting, setInviting] = useState(false);

  const [editMember, setEditMember] = useState<TeamMember | null>(null);
  const [editForm, setEditForm] = useState({ role: '', modules: [] as string[] });
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    api.getTeamMembers()
      .then((res) => setMembers(res.data ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load team'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function toggleInviteModule(m: string) {
    setInviteForm((prev) => ({ ...prev, modules: prev.modules.includes(m) ? prev.modules.filter((x) => x !== m) : [...prev.modules, m] }));
  }

  function toggleEditModule(m: string) {
    setEditForm((prev) => ({ ...prev, modules: prev.modules.includes(m) ? prev.modules.filter((x) => x !== m) : [...prev.modules, m] }));
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setError('');
    try {
      await api.inviteTeamMember({
        name: inviteForm.name,
        email: inviteForm.email || undefined,
        phone: inviteForm.phone || undefined,
        role: inviteForm.role,
        modules: inviteForm.modules,
      });
      setInviteOpen(false);
      setInviteForm({ name: '', email: '', phone: '', role: '', modules: [] });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send invite');
    } finally {
      setInviting(false);
    }
  }

  function openEdit(member: TeamMember) {
    setEditMember(member);
    setEditForm({ role: member.role, modules: member.modules });
  }

  async function handleSaveEdit() {
    if (!editMember) return;
    setSaving(true);
    try {
      await api.updateTeamMember(editMember.id, editForm);
      setEditMember(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update member');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(id: string) {
    if (!confirm('Remove this team member?')) return;
    try {
      await api.removeTeamMember(id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove member');
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Team</h2>
          <p className="mt-1 text-sm text-slate-500">Invite team members and manage their access.</p>
        </div>
        <Button leftIcon={<UserPlus className="h-4 w-4" />} onClick={() => setInviteOpen(true)}>Invite Member</Button>
      </div>

      {error && <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : members.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400">No team members yet.</div>
      ) : (
        <div className="space-y-3">
          {members.map((m) => (
            <div key={m.id} className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-slate-900">{m.name}</span>
                  <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-semibold text-primary-700">{m.role}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${m.status === 'active' ? 'bg-success-50 text-success-700' : 'bg-warning-50 text-warning-700'}`}>{m.status}</span>
                </div>
                <div className="text-xs text-slate-500 mt-1">Last active: {formatLastActive(m.lastLogin)}</div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button size="sm" variant="outline" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => openEdit(m)}>Edit Role</Button>
                <button onClick={() => handleRemove(m.id)} className="rounded-lg p-2 text-slate-400 hover:bg-error-50 hover:text-error-600" aria-label="Remove"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Invite modal */}
      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setInviteOpen(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={handleInvite} className="w-full max-w-sm rounded-2xl bg-white p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Invite Member</h3>
              <button type="button" onClick={() => setInviteOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
            </div>
            <input required placeholder="Name" value={inviteForm.name} onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
            <input type="email" placeholder="Email" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
            <input placeholder="Phone (for WhatsApp invite)" value={inviteForm.phone} onChange={(e) => setInviteForm({ ...inviteForm, phone: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
            <input required list="role-suggestions" placeholder="Role (e.g. Sales Executive)" value={inviteForm.role} onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
            <datalist id="role-suggestions">
              <option value="Manager" /><option value="Sales Executive" /><option value="Support Executive" /><option value="Content Creator" />
            </datalist>
            <div>
              <div className="mb-1.5 text-xs font-semibold text-slate-600">Module Access</div>
              <div className="grid grid-cols-2 gap-1.5">
                {MODULES.map((m) => (
                  <label key={m} className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs">
                    <input type="checkbox" checked={inviteForm.modules.includes(m)} onChange={() => toggleInviteModule(m)} className="h-3.5 w-3.5 rounded text-primary-600" />
                    {m}
                  </label>
                ))}
              </div>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1.5"><Mail className="h-3 w-3" /><Phone className="h-3 w-3" />Invite is sent via email and/or WhatsApp based on the details provided.</p>
            <Button type="submit" fullWidth loading={inviting}>Send Invite</Button>
          </form>
        </div>
      )}

      {/* Edit modal */}
      {editMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setEditMember(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Edit — {editMember.name}</h3>
              <button onClick={() => setEditMember(null)} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
            </div>
            <input value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
            <div className="grid grid-cols-2 gap-1.5">
              {MODULES.map((m) => (
                <label key={m} className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs">
                  <input type="checkbox" checked={editForm.modules.includes(m)} onChange={() => toggleEditModule(m)} className="h-3.5 w-3.5 rounded text-primary-600" />
                  {m}
                </label>
              ))}
            </div>
            <Button fullWidth loading={saving} onClick={handleSaveEdit}>Save Changes</Button>
          </div>
        </div>
      )}
    </div>
  );
}
