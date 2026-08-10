'use client';

import { useEffect, useState } from 'react';
import { UserPlus, Loader2, X, Pencil, Trash2, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';

interface AdminMember {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: 'SUPER_ADMIN' | 'MARKETING' | 'OPERATIONS';
  status: string;
  lastLogin: string | null;
}

const ROLES: AdminMember['role'][] = ['SUPER_ADMIN', 'MARKETING', 'OPERATIONS'];

const ROLE_HELP: Record<AdminMember['role'], string> = {
  SUPER_ADMIN: 'Full access to every admin tool.',
  MARKETING: 'TeleCRM, AI Studio, Send Quote.',
  OPERATIONS: 'Invoices, Support, Renewals, Website CMS.',
};

const formatLastActive = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Never logged in';

export default function AdminTeamPage() {
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', phone: '', role: 'MARKETING' as AdminMember['role'] });
  const [inviting, setInviting] = useState(false);

  const [editMember, setEditMember] = useState<AdminMember | null>(null);
  const [editRole, setEditRole] = useState<AdminMember['role']>('MARKETING');
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    api.getAdminMembers()
      .then((res) => setMembers(res.data ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load team'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setError('');
    try {
      await api.inviteAdminMember({
        name: inviteForm.name,
        email: inviteForm.email,
        phone: inviteForm.phone || undefined,
        role: inviteForm.role,
      });
      setInviteOpen(false);
      setInviteForm({ name: '', email: '', phone: '', role: 'MARKETING' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send invite');
    } finally {
      setInviting(false);
    }
  }

  function openEdit(member: AdminMember) {
    setEditMember(member);
    setEditRole(member.role);
  }

  async function handleSaveEdit() {
    if (!editMember) return;
    setSaving(true);
    try {
      await api.updateAdminMember(editMember.id, { role: editRole });
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
      await api.removeAdminMember(id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove member');
    }
  }

  const inputClass = 'w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-600/30';

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-white"><ShieldCheck className="h-5 w-5 text-primary-400" />Team</h2>
          <p className="mt-1 text-sm text-slate-400">Invite Marketing and Operations staff and manage their access.</p>
        </div>
        <button onClick={() => setInviteOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-500">
          <UserPlus className="h-4 w-4" />Invite Member
        </button>
      </div>

      {error && <div className="rounded-xl border border-error-500/40 bg-error-500/10 px-4 py-3 text-sm text-error-300">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-500" /></div>
      ) : members.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center text-sm text-slate-500">No team members yet. Invite your first Marketing or Operations staff.</div>
      ) : (
        <div className="space-y-3">
          {members.map((m) => (
            <div key={m.id} className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-white">{m.name}</span>
                  <span className="rounded-full bg-primary-600/20 px-2 py-0.5 text-xs font-semibold text-primary-300">{m.role.replace('_', ' ')}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${m.status === 'active' ? 'bg-success-500/15 text-success-300' : 'bg-warning-500/15 text-warning-300'}`}>{m.status}</span>
                </div>
                <div className="mt-1 text-xs text-slate-500">{m.email} · Last active: {formatLastActive(m.lastLogin)}</div>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                <button onClick={() => openEdit(m)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"><Pencil className="h-3.5 w-3.5" />Edit Role</button>
                <button onClick={() => handleRemove(m.id)} className="rounded-lg p-2 text-slate-500 hover:bg-error-500/10 hover:text-error-400" aria-label="Remove"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Invite modal */}
      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setInviteOpen(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={handleInvite} className="w-full max-w-sm space-y-4 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-6" style={{ maxHeight: '90vh' }}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Invite Member</h3>
              <button type="button" onClick={() => setInviteOpen(false)} className="text-slate-500 hover:text-slate-300"><X className="h-4 w-4" /></button>
            </div>
            <input required placeholder="Name" value={inviteForm.name} onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })} className={inputClass} />
            <input required type="email" placeholder="Email" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} className={inputClass} />
            <input placeholder="Phone (for WhatsApp invite)" value={inviteForm.phone} onChange={(e) => setInviteForm({ ...inviteForm, phone: e.target.value })} className={inputClass} />
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-400">Role</label>
              <select value={inviteForm.role} onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as AdminMember['role'] })} className={inputClass}>
                {ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
              </select>
              <p className="mt-1.5 text-xs text-slate-500">{ROLE_HELP[inviteForm.role]}</p>
            </div>
            <button type="submit" disabled={inviting} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-500 disabled:opacity-60">
              {inviting && <Loader2 className="h-4 w-4 animate-spin" />}Send Invite
            </button>
          </form>
        </div>
      )}

      {/* Edit modal */}
      {editMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEditMember(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Edit — {editMember.name}</h3>
              <button onClick={() => setEditMember(null)} className="text-slate-500 hover:text-slate-300"><X className="h-4 w-4" /></button>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-400">Role</label>
              <select value={editRole} onChange={(e) => setEditRole(e.target.value as AdminMember['role'])} className={inputClass}>
                {ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
              </select>
              <p className="mt-1.5 text-xs text-slate-500">{ROLE_HELP[editRole]}</p>
            </div>
            <button onClick={handleSaveEdit} disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-500 disabled:opacity-60">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}Save Changes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
