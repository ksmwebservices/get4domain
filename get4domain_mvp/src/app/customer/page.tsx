'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Home, FileText, Receipt, LifeBuoy, LogOut, Phone, Loader2, CalendarCheck, ClipboardList,
  CalendarClock, GraduationCap, MessageSquare, HardHat, Briefcase, Truck, Wrench, BookOpen,
  Package, Sprout, Sparkles, BedDouble, Dumbbell, Building2, FlaskConical, MapPin, Clock,
  Mail, X, ExternalLink, IndianRupee, Code2, BadgeCheck, Cog, Stethoscope, type LucideIcon,
} from 'lucide-react';
import TourNav from '@/components/TourNav';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://gapi.get4domain.com';
const TOKEN_KEY = 'g4d_customer_token';

async function portalFetch(path: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || 'Error');
  return body.data ?? body;
}

// The backend derives the portal shape from each industry's own config and sends
// lucide icon NAMES; this map turns them back into components. Anything unknown
// falls back to FileText rather than crashing the nav.
const ICONS: Record<string, LucideIcon> = {
  Home, FileText, Receipt, LifeBuoy, CalendarCheck, ClipboardList, CalendarClock, GraduationCap,
  MessageSquare, HardHat, Briefcase, Truck, Wrench, BookOpen, Package, Sprout, Sparkles,
  BedDouble, Dumbbell, Building2, FlaskConical, Code2, BadgeCheck, Cog, Stethoscope,
};

type TabKey = 'home' | 'records' | 'catalog' | 'invoices' | 'support';

interface PortalTab { key: TabKey; label: string; icon: string }
interface PortalShape {
  tabs: PortalTab[];
  recordsLabel: string;
  recordLabel: string;
  catalogLabel: string;
  invoicesLabel: string;
  showCatalog: boolean;
  openStatuses: string[];
}
interface Profile {
  contact: { id: string; name: string; phone: string; email?: string };
  vendor: { businessName?: string };
  industry: { key: string; label: string; record: { label: string; labelPlural: string }; contact: { label: string } };
  portal: PortalShape;
}
interface RecordItem { id: string; status: string; date: string; amount: number; notes?: string; catalogItem?: { name: string } }
interface InvoiceItem { id: string; invoiceNumber: string; total: number; status: string; createdAt: string }
interface CatalogItem { id: string; name: string; description?: string | null; price: number; unit?: string | null; image?: string | null; inStock: boolean | null }
interface ContactDetails {
  businessName: string | null; phone: string | null; whatsapp: string | null; email: string | null;
  address: string | null; businessHours: string | null; mapsLink: string | null;
}

const rupees = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;
const shortDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export default function CustomerPortal() {
  const [booting, setBooting] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  // login state
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [devOtp, setDevOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // data
  const [tab, setTab] = useState<TabKey>('home');
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [contactInfo, setContactInfo] = useState<ContactDetails | null>(null);
  const [contactOpen, setContactOpen] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const me = await portalFetch('/customer/me');
      setProfile(me);
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setProfile(null);
    } finally {
      setBooting(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem(TOKEN_KEY)) loadProfile();
    else setBooting(false);
  }, [loadProfile]);

  useEffect(() => {
    if (!profile) return;
    portalFetch('/customer/records').then(setRecords).catch(() => setRecords([]));
    portalFetch('/customer/invoices').then(setInvoices).catch(() => setInvoices([]));
    portalFetch('/customer/contact').then(setContactInfo).catch(() => setContactInfo(null));
    // Catalog is only fetched for industries whose customers actually browse one.
    if (profile.portal.showCatalog) portalFetch('/customer/catalog').then(setCatalog).catch(() => setCatalog([]));
  }, [profile]);

  // If the session's industry has no Catalog tab, never leave the user stranded
  // on one (e.g. a stale tab from a previous session).
  useEffect(() => {
    if (profile && !profile.portal.tabs.some((t) => t.key === tab)) setTab('home');
  }, [profile, tab]);

  const requestOtp = async () => {
    setBusy(true); setError('');
    try {
      const res = await portalFetch('/customer/request-otp', { method: 'POST', body: JSON.stringify({ phone }) });
      setDevOtp(res.devOtp ?? '');
      setStep('otp');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally { setBusy(false); }
  };

  const verify = async () => {
    setBusy(true); setError('');
    try {
      const res = await portalFetch('/customer/verify', { method: 'POST', body: JSON.stringify({ phone, otp }) });
      localStorage.setItem(TOKEN_KEY, res.token);
      await loadProfile();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid OTP');
    } finally { setBusy(false); }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setProfile(null); setStep('phone'); setPhone(''); setOtp('');
    setRecords([]); setInvoices([]); setCatalog([]); setContactInfo(null);
  };

  // ── Home screen figures, derived from data already loaded ──────────────────
  const stats = useMemo(() => {
    const unpaid = invoices.filter((i) => i.status !== 'PAID');
    const outstanding = unpaid.reduce((sum, i) => sum + (i.total ?? 0), 0);
    // "Open" is per-industry and comes from the backend's portal shape — a gym
    // membership is `active`, a shipment `in_transit`, a restaurant order
    // `preparing`. Hard-coding one list here silently emptied this card for
    // nine industries.
    const openStatuses = new Set(profile?.portal.openStatuses ?? []);
    const open = records.filter((r) => openStatuses.has((r.status ?? '').toLowerCase()));
    const now = Date.now();
    // "Next up" = the soonest still-open record dated today or later; falls back
    // to the most recent open one so the card is never empty when work exists.
    const upcoming = open
      .filter((r) => new Date(r.date).getTime() >= now - 86_400_000)
      .sort((a, b) => +new Date(a.date) - +new Date(b.date));
    const lifetime = records.reduce((sum, r) => sum + (r.amount ?? 0), 0);
    return { unpaidCount: unpaid.length, outstanding, openCount: open.length, next: upcoming[0] ?? open[0] ?? null, lifetime };
  }, [records, invoices, profile]);

  if (booting) {
    return (
      <div className="vendor-ui flex min-h-screen items-center justify-center bg-ink-950">
        <Loader2 className="h-6 w-6 animate-spin text-ink-400" />
      </div>
    );
  }

  // ---- Login ----
  if (!profile) {
    return (
      <div className="vendor-ui flex min-h-screen items-center justify-center bg-ink-950 bg-radial-glow p-5 text-ink-100">
        <div className="w-full max-w-sm rounded-2xl border border-ink-700/50 bg-ink-850/80 p-6 shadow-v-card backdrop-blur-sm">
          <div className="mb-5 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600/15"><Phone className="h-6 w-6 text-brand-400" /></div>
            <h1 className="text-lg font-bold text-ink-50">Customer Portal</h1>
            <p className="text-sm text-ink-400">Sign in with your phone number</p>
          </div>
          {error && <div className="mb-3 rounded-xl border border-error-500/30 bg-error-500/10 px-3 py-2 text-sm text-error-400">{error}</div>}
          {step === 'phone' ? (
            <div className="space-y-3">
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" inputMode="tel" className="input" />
              <button onClick={requestOtp} disabled={busy || !phone} className="btn-primary w-full">
                {busy ? 'Sending…' : 'Send OTP'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="Enter OTP" inputMode="numeric" className="input text-center text-lg tracking-widest" />
              {devOtp && <p className="text-center text-xs text-ink-400">Dev OTP: <span className="font-mono font-semibold text-gold-400">{devOtp}</span></p>}
              <button onClick={verify} disabled={busy || !otp} className="btn-primary w-full">
                {busy ? 'Verifying…' : 'Verify & Sign In'}
              </button>
              <button onClick={() => setStep('phone')} className="w-full text-center text-xs text-ink-400 hover:text-ink-200">Change number</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---- Authenticated ----
  const { portal } = profile;
  const businessName = contactInfo?.businessName ?? profile.vendor.businessName ?? 'Your Provider';
  const hasContactChannel = Boolean(contactInfo?.phone || contactInfo?.whatsapp || contactInfo?.email || contactInfo?.address);

  return (
    <div className="vendor-ui min-h-screen bg-ink-950 bg-radial-glow pb-20 text-ink-100">
      <header className="flex items-center justify-between border-b border-ink-700/50 bg-ink-900/70 px-5 py-4 backdrop-blur-xl">
        <div>
          <div className="text-sm font-bold text-ink-50">{businessName}</div>
          <div className="text-xs text-ink-400">Hi, {profile.contact.name}</div>
        </div>
        <div className="flex items-center gap-1">
          {hasContactChannel && (
            <button onClick={() => setContactOpen(true)} aria-label="Contact us" className="rounded-lg p-2 text-ink-300 hover:bg-ink-800/60 hover:text-ink-100">
              <Phone className="h-5 w-5" />
            </button>
          )}
          <button onClick={logout} aria-label="Sign out" className="rounded-lg p-2 text-ink-400 hover:bg-ink-800/60 hover:text-ink-100"><LogOut className="h-5 w-5" /></button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl p-5">
        {tab === 'home' && (
          <div className="space-y-4">
            <h1 className="text-xl font-bold text-ink-50">Welcome back 👋</h1>

            {/* Next up — the single most useful thing for a customer to see. */}
            {stats.next && (
              <div className="rounded-2xl border border-brand-500/30 bg-brand-600/10 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-brand-300">Next {portal.recordLabel}</div>
                <div className="mt-1 text-base font-bold text-ink-50">{stats.next.catalogItem?.name ?? portal.recordLabel}</div>
                <div className="mt-0.5 text-xs text-ink-300">{shortDate(stats.next.date)} · {rupees(stats.next.amount)}</div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setTab('records')} className="rounded-2xl border border-ink-700/50 bg-ink-850/80 p-4 text-left transition hover:border-ink-600/70">
                <div className="text-2xl font-bold text-ink-50">{records.length}</div>
                <div className="text-xs text-ink-400">{portal.recordsLabel}</div>
                {stats.openCount > 0 && <div className="mt-1 text-[11px] font-semibold text-brand-300">{stats.openCount} open</div>}
              </button>
              <button onClick={() => setTab('invoices')} className="rounded-2xl border border-ink-700/50 bg-ink-850/80 p-4 text-left transition hover:border-ink-600/70">
                <div className="text-2xl font-bold text-ink-50">{stats.unpaidCount}</div>
                <div className="text-xs text-ink-400">Unpaid {portal.invoicesLabel.toLowerCase()}</div>
                {stats.outstanding > 0 && <div className="mt-1 text-[11px] font-semibold text-gold-400">{rupees(stats.outstanding)} due</div>}
              </button>
            </div>

            <div className="rounded-2xl border border-ink-700/50 bg-ink-850/80 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-ink-400">Total value with {businessName}</span>
                <span className="flex items-center gap-1 text-base font-bold text-ink-50"><IndianRupee className="h-4 w-4 text-ink-400" />{stats.lifetime.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Recent activity — a light history strip, no drill-in writes. */}
            {records.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Recent activity</div>
                <div className="divide-y divide-ink-700/40 overflow-hidden rounded-2xl border border-ink-700/50 bg-ink-850/80">
                  {records.slice(0, 4).map((r) => (
                    <div key={r.id} className="flex items-center justify-between px-4 py-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-ink-100">{r.catalogItem?.name ?? portal.recordLabel}</div>
                        <div className="text-[11px] text-ink-400">{shortDate(r.date)}</div>
                      </div>
                      <span className="ml-3 shrink-0 rounded-full bg-ink-800/70 px-2 py-0.5 text-[11px] font-semibold capitalize text-ink-300">{r.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {hasContactChannel && (
              <button onClick={() => setContactOpen(true)} className="btn-ghost w-full">
                <Phone className="h-4 w-4" /> Contact {businessName}
              </button>
            )}
          </div>
        )}

        {tab === 'records' && (
          <div className="space-y-2">
            <h1 className="mb-2 text-lg font-bold text-ink-50">Your {portal.recordsLabel}</h1>
            {records.length === 0 ? <p className="text-sm text-ink-500">Nothing here yet.</p> : records.map((r) => (
              <div key={r.id} className="rounded-2xl border border-ink-700/50 bg-ink-850/80 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-semibold text-ink-50">{r.catalogItem?.name ?? portal.recordLabel}</span>
                  <span className="shrink-0 rounded-full bg-ink-800/70 px-2 py-0.5 text-xs font-semibold capitalize text-ink-300">{r.status}</span>
                </div>
                <div className="mt-1 text-xs text-ink-400">{shortDate(r.date)} · {rupees(r.amount)}</div>
                {r.notes && <p className="mt-2 text-xs text-ink-300">{r.notes}</p>}
              </div>
            ))}
          </div>
        )}

        {tab === 'catalog' && (
          <div className="space-y-2">
            <h1 className="mb-1 text-lg font-bold text-ink-50">{portal.catalogLabel}</h1>
            <p className="mb-3 text-xs text-ink-400">Browse what {businessName} offers. To place a request, contact them directly.</p>
            {catalog.length === 0 ? <p className="text-sm text-ink-500">Nothing listed yet.</p> : catalog.map((c) => (
              <div key={c.id} className="flex gap-3 rounded-2xl border border-ink-700/50 bg-ink-850/80 p-4">
                {c.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.image} alt={c.name} className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-sm font-semibold text-ink-50">{c.name}</span>
                    <span className="shrink-0 text-sm font-bold text-ink-50">{rupees(c.price)}{c.unit ? <span className="text-xs font-normal text-ink-400"> / {c.unit}</span> : null}</span>
                  </div>
                  {c.description && <p className="mt-1 line-clamp-2 text-xs text-ink-400">{c.description}</p>}
                  {c.inStock === false && <span className="mt-2 inline-block rounded-full bg-error-500/10 px-2 py-0.5 text-[11px] font-semibold text-error-400">Out of stock</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'invoices' && (
          <div className="space-y-2">
            <h1 className="mb-2 text-lg font-bold text-ink-50">{portal.invoicesLabel}</h1>
            {stats.outstanding > 0 && (
              <div className="mb-3 rounded-2xl border border-gold-500/30 bg-gold-500/10 p-4">
                <div className="text-xs text-gold-300">Outstanding balance</div>
                <div className="text-xl font-bold text-gold-400">{rupees(stats.outstanding)}</div>
              </div>
            )}
            {invoices.length === 0 ? <p className="text-sm text-ink-500">No {portal.invoicesLabel.toLowerCase()} yet.</p> : invoices.map((inv) => (
              <div key={inv.id} className="rounded-2xl border border-ink-700/50 bg-ink-850/80 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-ink-50">{inv.invoiceNumber}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${inv.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gold-500/10 text-gold-400'}`}>{inv.status}</span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-xs text-ink-400">{shortDate(inv.createdAt)}</span>
                  <span className="text-base font-bold text-ink-50">{rupees(inv.total)}</span>
                </div>
                {inv.status !== 'PAID' && (
                  // Deliberately NOT a payment affordance — online payment from the
                  // portal is separate future work involving real money.
                  <p className="mt-3 rounded-xl border border-ink-700/50 bg-ink-900/60 px-3 py-2 text-[11px] text-ink-400">
                    Your payment link will be shared by {businessName}. Contact them for options.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'support' && (
          <div className="space-y-3">
            <h1 className="mb-2 text-lg font-bold text-ink-50">Support</h1>
            {hasContactChannel ? (
              <ContactPanel info={contactInfo!} businessName={businessName} />
            ) : (
              <div className="rounded-2xl border border-ink-700/50 bg-ink-850/80 p-4 text-sm text-ink-400">
                {businessName} hasn&apos;t published contact details yet.
              </div>
            )}
          </div>
        )}
      </main>

      {/* Contact modal — real details from the vendor's own CMS record. */}
      {contactOpen && contactInfo && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-5" onClick={() => setContactOpen(false)}>
          <div className="w-full max-w-md rounded-t-3xl border border-ink-700/60 bg-ink-850 p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-base font-bold text-ink-50">{businessName}</h2>
                <p className="text-xs text-ink-400">Get in touch</p>
              </div>
              <button onClick={() => setContactOpen(false)} aria-label="Close" className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-800/60 hover:text-ink-100"><X className="h-5 w-5" /></button>
            </div>
            <ContactPanel info={contactInfo} businessName={businessName} />
          </div>
        </div>
      )}

      {/* Bottom nav — shaped per industry by the backend. */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center border-t border-ink-700/50 bg-ink-900/90 backdrop-blur-xl">
        {portal.tabs.map((item) => {
          const Ic = ICONS[item.icon] ?? FileText;
          const active = tab === item.key;
          return (
            <button key={item.key} onClick={() => setTab(item.key)}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${active ? 'text-brand-400' : 'text-ink-400 hover:text-ink-200'}`}>
              <Ic className="h-5 w-5" />
              <span className="max-w-full truncate px-1">{item.label}</span>
            </button>
          );
        })}
      </nav>
      <TourNav />
    </div>
  );
}

/**
 * Shared contact block — rendered both in the Support tab and the header modal so
 * the two can never show different details. Every row is a real, safe action:
 * tel:, wa.me, mailto:, and the vendor's own Google Maps link.
 */
function ContactPanel({ info, businessName }: { info: ContactDetails; businessName: string }) {
  const waNumber = (info.whatsapp ?? '').replace(/[^\d]/g, '');
  const rows: { icon: LucideIcon; label: string; value: string; href?: string }[] = [];
  if (info.phone) rows.push({ icon: Phone, label: 'Call', value: info.phone, href: `tel:${info.phone}` });
  if (waNumber) rows.push({ icon: MessageSquare, label: 'WhatsApp', value: info.whatsapp!, href: `https://wa.me/${waNumber}` });
  if (info.email) rows.push({ icon: Mail, label: 'Email', value: info.email, href: `mailto:${info.email}` });
  if (info.address) rows.push({ icon: MapPin, label: 'Address', value: info.address, href: info.mapsLink ?? undefined });
  if (info.businessHours) rows.push({ icon: Clock, label: 'Hours', value: info.businessHours });

  if (rows.length === 0) {
    return <div className="rounded-2xl border border-ink-700/50 bg-ink-900/60 p-4 text-sm text-ink-400">No contact details published yet.</div>;
  }

  return (
    <div className="divide-y divide-ink-700/40 overflow-hidden rounded-2xl border border-ink-700/50 bg-ink-900/60">
      {rows.map((r) => {
        const Ic = r.icon;
        const body = (
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600/15"><Ic className="h-4 w-4 text-brand-400" /></div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">{r.label}</div>
              <div className="truncate text-sm text-ink-100">{r.value}</div>
            </div>
            {r.href && <ExternalLink className="h-4 w-4 shrink-0 text-ink-500" />}
          </div>
        );
        return r.href ? (
          <a key={r.label} href={r.href} target={r.href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer"
            aria-label={`${r.label} ${businessName}`} className="block transition hover:bg-ink-800/50">{body}</a>
        ) : (
          <div key={r.label}>{body}</div>
        );
      })}
    </div>
  );
}
