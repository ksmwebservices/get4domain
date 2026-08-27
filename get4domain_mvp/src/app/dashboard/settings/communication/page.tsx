'use client';

import { useEffect, useState } from 'react';
import { Loader2, MessageCircle, Mail, Smartphone, Save, ShieldCheck, ShieldAlert, Clock } from 'lucide-react';
import { api, type VendorCommsSettings, type VendorCommsPatch } from '@/lib/api';

const inputCls =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100';

/**
 * Vendor self-service for the three communication channels.
 *
 * The channels are deliberately not symmetric, and the page says so out loud:
 * WhatsApp is genuinely the vendor's own number, while SMS and Email run on
 * shared platform infrastructure (one DLT sender-ID, one verified sending
 * domain) that a vendor cannot replace without their own compliance process.
 * So those two offer branding only — and the copy explains why, rather than
 * leaving the vendor to wonder where the "use my own domain" field went.
 */
export default function CommunicationSettingsPage() {
  const [settings, setSettings] = useState<VendorCommsSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getMyCommsSettings()
      .then((r) => setSettings(r.data ?? null))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load your communication settings.'))
      .finally(() => setLoading(false));
  }, []);

  // Local edits are held in `settings` and sent as one PATCH; blanks are sent as
  // null so clearing a field genuinely falls back to the platform/business default.
  const set = <K extends keyof VendorCommsSettings>(key: K, value: VendorCommsSettings[K]) =>
    setSettings((s) => (s ? { ...s, [key]: value } : s));

  const blankToNull = (v: string | null) => (v && v.trim() ? v.trim() : null);

  async function save() {
    if (!settings) return;
    setSaving(true);
    setSaved(false);
    setError('');
    const payload: VendorCommsPatch = {
      waEnabled: settings.waEnabled,
      waPhoneNumberId: blankToNull(settings.waPhoneNumberId),
      waDisplayNumber: blankToNull(settings.waDisplayNumber),
      waTemplateId: blankToNull(settings.waTemplateId),
      waGreeting: blankToNull(settings.waGreeting),
      smsBusinessName: blankToNull(settings.smsBusinessName),
      emailFromName: blankToNull(settings.emailFromName),
      emailReplyTo: blankToNull(settings.emailReplyTo),
    };
    try {
      const r = await api.updateMyCommsSettings(payload);
      setSettings(r.data ?? settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }
  if (!settings) {
    return <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error || 'Not available.'}</div>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Communication Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Control how your WhatsApp, SMS and email messages reach your customers — and whose name they carry.
        </p>
      </div>

      {error && <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error}</div>}

      {/* ── WhatsApp — full self-service ───────────────────────────────────── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">WhatsApp — your own number</h2>
              <p className="mt-0.5 text-xs text-slate-500">Messages go out from your business&apos;s own WhatsApp number, not ours.</p>
            </div>
          </div>
          <WaStatusBadge status={settings.waStatus} />
        </div>

        <label className="mt-4 flex items-center gap-2.5 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={settings.waEnabled}
            onChange={(e) => set('waEnabled', e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-400"
          />
          WhatsApp channel is on
          <span className="text-xs text-slate-400">(turn off and the bot stops replying — incoming messages are still saved)</span>
        </label>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">WhatsApp number (display)</label>
            <input
              className={inputCls}
              placeholder="+91 98765 43210"
              value={settings.waDisplayNumber ?? ''}
              onChange={(e) => set('waDisplayNumber', e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Provider number ID</label>
            <input
              className={inputCls}
              placeholder="1122334455"
              value={settings.waPhoneNumberId ?? ''}
              onChange={(e) => set('waPhoneNumberId', e.target.value)}
            />
            <p className="mt-1 text-[11px] text-slate-400">
              From your WhatsApp Business provider. This is what routes incoming messages to your account — changing it needs a fresh
              verification by our team.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Your message template ID (optional)</label>
            <input
              className={inputCls}
              placeholder="Leave blank to use ours"
              value={settings.waTemplateId ?? ''}
              onChange={(e) => set('waTemplateId', e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Bot greeting (optional)</label>
            <input
              className={inputCls}
              placeholder={`Thanks for messaging ${settings.businessName}!`}
              value={settings.waGreeting ?? ''}
              onChange={(e) => set('waGreeting', e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* ── SMS — branding only ────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">SMS — your business name</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              SMS in India goes out on a TRAI-registered (DLT) sender ID, which we hold and maintain for every vendor on the platform.
              You can&apos;t be given a separate one without your own DLT registration — but your business name goes inside every message,
              so customers know it&apos;s you.
            </p>
          </div>
        </div>
        <div className="mt-4 sm:max-w-sm">
          <label className="mb-1 block text-xs font-medium text-slate-600">Business name shown in SMS</label>
          <input
            className={inputCls}
            placeholder={settings.businessName}
            value={settings.smsBusinessName ?? ''}
            onChange={(e) => set('smsBusinessName', e.target.value)}
          />
          <p className="mt-1 text-[11px] text-slate-400">Blank uses your account name, {settings.businessName}.</p>
        </div>
      </section>

      {/* ── Email — branding only ──────────────────────────────────────────── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Email — your sender name</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Email is sent from our verified sending domain so it reliably reaches the inbox. The address stays ours, but the name your
              customer sees is yours — and their replies come straight to you.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">From name</label>
            <input
              className={inputCls}
              placeholder={settings.businessName}
              value={settings.emailFromName ?? ''}
              onChange={(e) => set('emailFromName', e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Replies go to</label>
            <input
              className={inputCls}
              type="email"
              placeholder="you@yourbusiness.com"
              value={settings.emailReplyTo ?? ''}
              onChange={(e) => set('emailReplyTo', e.target.value)}
            />
          </div>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          Customers will see: <span className="font-medium text-slate-500">{(settings.emailFromName || settings.businessName).trim()}</span>{' '}
          &lt;our verified address&gt;
        </p>
      </section>

      <div className="flex items-center gap-4">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        {saved && <span className="text-sm font-medium text-success-600">✓ Saved</span>}
      </div>
    </div>
  );
}

/** Verification state of the vendor's WhatsApp number — outbound only trusts `verified`. */
function WaStatusBadge({ status }: { status: string }) {
  if (status === 'verified') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success-50 px-2.5 py-1 text-[11px] font-semibold text-success-700">
        <ShieldCheck className="h-3.5 w-3.5" /> Verified
      </span>
    );
  }
  if (status === 'pending') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
        <Clock className="h-3.5 w-3.5" /> Awaiting verification
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
      <ShieldAlert className="h-3.5 w-3.5" /> Not set up
    </span>
  );
}
