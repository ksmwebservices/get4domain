'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Sparkles, MessageSquare, Video, FileText, Image as ImageIcon,
  Megaphone, Mail, MessageCircle, Smartphone, RefreshCw, Download, Save, Library, Wallet, Share2,
  Palette, CreditCard, IdCard, ExternalLink,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { Input, Textarea, Select } from '@/components/ui/Input';
import EmptyState from '@/domainapp/shared/EmptyState';

interface ContentType {
  key: string;
  label: string;
  icon: typeof Sparkles;
  cost: number;
}

const CONTENT_TYPES: ContentType[] = [
  { key: 'social_post', label: 'Social Post', icon: MessageSquare, cost: 5 },
  { key: 'reel_script', label: 'Reel Script', icon: Video, cost: 8 },
  { key: 'blog_post', label: 'Blog Post', icon: FileText, cost: 15 },
  { key: 'festival_poster', label: 'Festival Poster', icon: ImageIcon, cost: 12 },
  { key: 'ad_creative', label: 'Ad Creative', icon: Megaphone, cost: 10 },
  { key: 'email', label: 'Email Content', icon: Mail, cost: 6 },
  { key: 'whatsapp', label: 'WhatsApp Message', icon: MessageCircle, cost: 3 },
  { key: 'sms', label: 'SMS Text', icon: Smartphone, cost: 2 },
];

const TONES = ['Professional', 'Friendly', 'Excited', 'Formal', 'Playful'];

// Content types where a visual image makes sense — these show the "upload your own
// image" option (use a real product/property photo or logo instead of AI imagery).
const IMAGE_TYPES = new Set(['social_post', 'festival_poster', 'ad_creative']);

// Two creation modes, chosen up front — AI creates from a prompt, or you pick a
// ready-made template and fill in your details. (Library holds saved work.)
type Mode = 'ai' | 'template' | 'library';
const MODES: { key: Mode; label: string; icon: typeof Sparkles; blurb: string }[] = [
  { key: 'ai', label: 'AI Generate', icon: Sparkles, blurb: 'Describe it — AI creates an original design' },
  { key: 'template', label: 'AI Template', icon: Palette, blurb: 'Pick a ready-made template, fill in your details' },
  { key: 'library', label: 'Library', icon: Library, blurb: 'Your saved generations' },
];

const DOC_ICON: Record<string, typeof FileText> = {
  letterhead: FileText,
  visiting_card: CreditCard,
  id_card: IdCard,
};

// A data-fill field definition — the shape the Business-Documents backend returns
// and (later) the Template-Driven CMS `cmsSchema` will share, so these forms adopt
// the schema without a rewrite.
interface FieldDef {
  key: string;
  label: string;
  type?: 'text' | 'textarea';
  required?: boolean;
  maxLength?: number;
  prefillFrom?: 'businessName' | 'name' | 'email';
}
interface DocTemplate { key: string; label: string; description: string; fields: FieldDef[] }
// A ready-made design template synced from the design provider (kept provider-agnostic
// in the UI). `source=canva` is only an internal identifier for the current provider.
interface DesignTemplate { id: string; name: string; thumbnail?: string | null; industry?: string | null; fields?: FieldDef[] | null }

interface SavedItem {
  id: string;
  type: string;
  typeLabel: string;
  content: string;
  createdAt: string;
}

export default function AiStudioPage() {
  const { user } = useAuth();
  // Internal Get4Domain staff (Admin Platform) use AI Studio for free — the
  // backend skips wallet deduction for them — so hide all wallet/credit UI.
  const isInternalStaff = user?.role === 'admin' || user?.role === 'super_admin';
  const [mode, setMode] = useState<Mode>('ai');
  const [active, setActive] = useState<ContentType | null>(null);
  const [templates, setTemplates] = useState<{ id: string; name: string; prompt: string; thumbnail?: string | null }[]>([]);
  const [purpose, setPurpose] = useState('');
  const [tone, setTone] = useState(TONES[0]);
  const [details, setDetails] = useState('');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState('');
  const [genError, setGenError] = useState('');
  const [library, setLibrary] = useState<SavedItem[]>([]);
  const [balance, setBalance] = useState<number | null>(null);

  // Prefill a field-def form from the vendor's known profile data.
  const prefill = useCallback((fields: FieldDef[]): Record<string, string> => {
    const map: Record<string, string> = {};
    for (const f of fields) {
      if (f.prefillFrom === 'businessName') map[f.key] = user?.businessName ?? '';
      else if (f.prefillFrom === 'name') map[f.key] = user?.name ?? '';
      else if (f.prefillFrom === 'email') map[f.key] = user?.email ?? '';
      else map[f.key] = '';
    }
    return map;
  }, [user]);

  // ── Business Documents ────────────────────────────────────────────────────
  const [docTemplates, setDocTemplates] = useState<DocTemplate[]>([]);
  const [docSel, setDocSel] = useState<DocTemplate | null>(null);
  const [docValues, setDocValues] = useState<Record<string, string>>({});
  const [docLogo, setDocLogo] = useState('');
  const [docPreview, setDocPreview] = useState('');
  const [docBusy, setDocBusy] = useState(false);

  useEffect(() => {
    if (mode !== 'template' || docTemplates.length) return;
    api.businessDocTemplates().then((r) => setDocTemplates((r.data ?? []) as DocTemplate[])).catch(() => setDocTemplates([]));
  }, [mode, docTemplates.length]);

  const openDoc = (t: DocTemplate) => {
    setDocSel(t);
    setDocValues(prefill(t.fields));
    setDocLogo('');
    setDocPreview('');
  };

  const renderDoc = useCallback(async () => {
    if (!docSel) return;
    setDocBusy(true);
    try {
      const r = await api.renderBusinessDocument({ type: docSel.key, values: docValues, brand: docLogo ? { logoUrl: docLogo } : undefined });
      setDocPreview((r.data?.html as string) ?? '');
    } catch { /* preview stays as-is */ } finally { setDocBusy(false); }
  }, [docSel, docValues, docLogo]);

  // Debounced live preview via the backend renderer (same HTML the print uses).
  useEffect(() => {
    if (!docSel) return;
    const t = setTimeout(renderDoc, 400);
    return () => clearTimeout(t);
  }, [docSel, docValues, docLogo, renderDoc]);

  const printDoc = () => {
    if (!docPreview) return;
    const w = window.open('', '_blank', 'width=820,height=1000');
    if (!w) return;
    // Same print-to-PDF mechanism the invoice download uses.
    w.document.write(`<!doctype html><html><head><title>${docSel?.label ?? 'document'}</title><style>@media print{body{margin:0}}body{margin:24px;background:#fff}</style></head><body>${docPreview}<script>window.onload=function(){window.print();}</script></body></html>`);
    w.document.close();
  };

  // ── Ready-made design templates (synced from the design provider; provider is
  //    kept out of the UI and gated on the account being connected) ─────────────
  const [designTemplates, setDesignTemplates] = useState<DesignTemplate[]>([]);
  const [designLoading, setDesignLoading] = useState(false);
  const [designSel, setDesignSel] = useState<DesignTemplate | null>(null);
  const [designValues, setDesignValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (mode !== 'template') return;
    setDesignLoading(true);
    const q = `?source=canva${user?.industry ? `&industry=${encodeURIComponent(user.industry)}` : ''}`;
    api.aiTemplates(q).then((r) => setDesignTemplates((r.data ?? []) as DesignTemplate[])).catch(() => setDesignTemplates([])).finally(() => setDesignLoading(false));
  }, [mode, user?.industry]);

  const openDesign = (t: DesignTemplate) => {
    setDesignSel(t);
    setDesignValues(prefill(t.fields ?? []));
  };

  // Video / Reel generation (Runway or HeyGen, admin-selectable; async job).
  const [videoOpen, setVideoOpen] = useState(false);
  const [videoProvider, setVideoProvider] = useState<'runway' | 'heygen' | 'none'>('none');
  const [videoCost, setVideoCost] = useState(0);
  const [videoInput, setVideoInput] = useState('');
  const [videoBusy, setVideoBusy] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState('');
  const videoPoll = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => { if (videoPoll.current) { clearInterval(videoPoll.current); videoPoll.current = null; } };
  useEffect(() => () => stopPolling(), []);

  const openVideo = async () => {
    setVideoOpen(true); setVideoInput(''); setVideoUrl(null); setVideoError(''); setVideoBusy(false);
    try {
      const res = await api.getVideoProvider();
      setVideoProvider(res.data?.provider ?? 'none');
      setVideoCost(res.data?.cost ?? 0);
    } catch { setVideoProvider('none'); setVideoCost(0); }
  };

  const closeVideo = () => { stopPolling(); setVideoOpen(false); };

  const generateVideo = async () => {
    setVideoBusy(true); setVideoUrl(null); setVideoError('');
    try {
      const payload = videoProvider === 'heygen' ? { script: videoInput } : { prompt: videoInput };
      const res = await api.generateVideo(payload);
      const { jobId, provider } = res.data ?? {};
      if (!jobId) throw new Error('Could not start the video job.');
      // Poll until done/failed (video takes ~30–90s).
      stopPolling();
      videoPoll.current = setInterval(async () => {
        try {
          const s = await api.getVideoStatus(provider ?? videoProvider, jobId);
          if (s.data?.status === 'done') { stopPolling(); setVideoUrl(s.data?.url ?? null); setVideoBusy(false); }
          else if (s.data?.status === 'failed') { stopPolling(); setVideoError('Video generation failed. Please try again.'); setVideoBusy(false); }
        } catch { /* keep polling */ }
      }, 4000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Video generation failed';
      setVideoError(/wallet|insufficient|balance/i.test(msg) ? 'Your wallet balance is too low for a video. Top up to continue.' : msg);
      setVideoBusy(false);
    }
  };

  const storageKey = `g4d_ai_library_${user?.id ?? 'anon'}`;

  const refreshBalance = useCallback(() => {
    if (isInternalStaff) return; // no wallet for internal staff
    api.getWalletBalance().then((res) => setBalance(res.data?.balance ?? 0)).catch(() => setBalance(null));
  }, [isInternalStaff]);
  useEffect(() => { refreshBalance(); }, [refreshBalance]);

  const loadLibrary = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      setLibrary(JSON.parse(localStorage.getItem(storageKey) ?? '[]'));
    } catch {
      setLibrary([]);
    }
  }, [storageKey]);

  useEffect(() => { loadLibrary(); }, [loadLibrary]);

  // AI template library (2.2) — load admin-created starting-point templates (prompt
  // source only) for the selected content type + this vendor's industry.
  useEffect(() => {
    if (!active) { setTemplates([]); return; }
    let cancelled = false;
    const q = `?source=prompt&contentType=${encodeURIComponent(active.key)}${user?.industry ? `&industry=${encodeURIComponent(user.industry)}` : ''}`;
    api.aiTemplates(q).then((res) => { if (!cancelled) setTemplates(res.data ?? []); }).catch(() => { if (!cancelled) setTemplates([]); });
    return () => { cancelled = true; };
  }, [active, user?.industry]);

  const [uploadImg, setUploadImg] = useState<string | null>(null);
  const [resultImg, setResultImg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const uploadContentImage = async (file: File) => {
    setUploading(true); setGenError('');
    try {
      const r = await api.uploadImage(file);
      setUploadImg(r.data?.url ?? null);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Image upload failed');
    } finally {
      setUploading(false);
    }
  };

  const openType = (ct: ContentType) => {
    setActive(ct); setPurpose(''); setDetails(''); setTone(TONES[0]); setResult('');
    setUploadImg(null); setResultImg(null);
  };

  const generate = async () => {
    if (!active) return;
    setGenerating(true);
    setResult('');
    setGenError('');
    try {
      const res = await api.generateAiContent({
        channel: active.key,
        vendorIndustry: user?.industry ?? 'general',
        offerDetails: `${purpose}. Details: ${details}`,
        tone,
        skipImage: !!uploadImg, // vendor supplied their own image → skip AI image
      });
      setResult(res.data?.caption ?? res.data?.content ?? res.data?.text ?? JSON.stringify(res.data));
      setResultImg(uploadImg ?? (res.data?.imageUrl as string | null) ?? null);
      refreshBalance();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'generation failed';
      // Graceful, never a dead-end: distinguish config vs. wallet vs. transient.
      if (/not configured|api key|gateway|unauthor/i.test(msg)) {
        setGenError('AI Studio needs to be configured by your administrator. Please contact support.');
      } else if (/wallet|insufficient|balance/i.test(msg)) {
        setGenError('Your wallet balance is too low for this generation. Top up to continue.');
      } else {
        setGenError(`Could not generate right now: ${msg}. Please try again.`);
      }
    } finally {
      setGenerating(false);
    }
  };

  const saveToLibrary = () => {
    if (!active || !result) return;
    const item: SavedItem = {
      id: `ai_${Date.now()}`,
      type: active.key,
      typeLabel: active.label,
      content: result,
      createdAt: new Date().toISOString(),
    };
    const next = [item, ...library];
    setLibrary(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  };

  const download = (content: string, name: string) => {
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url; a.download = `${name}.txt`; a.click();
  };

  // Native share (2.4) — vendor taps Share and the OS share sheet opens the native
  // FB/IG/WhatsApp/etc. app pre-loaded (no Meta API needed). Falls back to copy.
  const shareResult = async () => {
    const nav = navigator as Navigator & { canShare?: (d?: unknown) => boolean };
    try {
      if (resultImg && typeof nav.share === 'function' && typeof nav.canShare === 'function') {
        try {
          const resp = await fetch(resultImg);
          const blob = await resp.blob();
          const file = new File([blob], 'get4domain.png', { type: blob.type || 'image/png' });
          if (nav.canShare({ files: [file] })) { await nav.share({ files: [file], text: result }); return; }
        } catch { /* image share unavailable — fall through to text */ }
      }
      if (typeof nav.share === 'function') {
        await nav.share({ title: 'Get4Domain', text: result });
      } else {
        await navigator.clipboard.writeText(result);
        setGenError('Copied to clipboard — sharing isn’t supported on this browser.');
      }
    } catch { /* user cancelled or share failed — no-op */ }
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <Sparkles className="h-5 w-5 text-primary-600" /> AI Studio
          </h1>
          <p className="text-sm text-slate-500">Create on-brand content, templates and documents</p>
        </div>
        {isInternalStaff ? (
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-success-200 bg-success-50 px-3 py-1.5 text-sm font-semibold text-success-700">
            <Sparkles className="h-4 w-4" /> Free for internal team
          </span>
        ) : (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700">
              <Wallet className="h-4 w-4 text-primary-600" />{balance !== null ? `₹${(balance / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—'}
            </span>
            <Link href="/dashboard/wallet" className="rounded-xl bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700">+ Top Up</Link>
          </div>
        )}
      </div>

      {/* Mode selector — chosen up front, one correct flow per content kind */}
      <div className="mb-6 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {MODES.map((m) => {
          const Ic = m.icon; const on = mode === m.key;
          return (
            <button key={m.key} onClick={() => { setMode(m.key); if (m.key === 'library') loadLibrary(); }}
              className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-colors ${on ? 'border-primary-400 bg-primary-50/60 ring-1 ring-primary-200' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
              <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${on ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-500'}`}><Ic className="h-5 w-5" /></span>
              <span className="min-w-0">
                <span className={`block text-sm font-bold ${on ? 'text-primary-800' : 'text-slate-800'}`}>{m.label}</span>
                <span className="mt-0.5 block text-xs text-slate-400">{m.blurb}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* ── MODE: AI GENERATE ─────────────────────────────────────────────── */}
      {mode === 'ai' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {CONTENT_TYPES.map((ct) => {
              const Ic = ct.icon;
              return (
                <Card key={ct.key} hover className="cursor-pointer" onClick={() => openType(ct)}>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><Ic className="h-5 w-5" /></div>
                  <h3 className="mt-3 font-semibold text-slate-900">{ct.label}</h3>
                  <p className="mt-0.5 text-xs text-slate-400">{isInternalStaff ? 'Free' : `~₹${ct.cost} / generation`}</p>
                </Card>
              );
            })}
            <Card hover className="cursor-pointer" onClick={openVideo}>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><Video className="h-5 w-5" /></div>
              <h3 className="mt-3 font-semibold text-slate-900">Reel / Video</h3>
              <p className="mt-0.5 text-xs text-slate-400">{isInternalStaff ? 'Free' : 'wallet — per video'}</p>
            </Card>
          </div>
        </div>
      )}

      {/* ── MODE: AI TEMPLATE ─────────────────────────────────────────────── */}
      {/* One library of ready-made templates: business documents (always available)
          + synced design templates (when the provider account is connected). */}
      {mode === 'template' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {/* Business documents — coded, print-ready, always available */}
            {docTemplates.map((t) => {
              const Ic = DOC_ICON[t.key] ?? FileText;
              return (
                <Card key={t.key} hover className="cursor-pointer" onClick={() => openDoc(t)}>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><Ic className="h-5 w-5" /></div>
                  <h3 className="mt-3 font-semibold text-slate-900">{t.label}</h3>
                  <p className="mt-0.5 text-xs text-slate-400">{t.description}</p>
                </Card>
              );
            })}
            {/* Synced design templates (provider kept out of the UI) */}
            {designTemplates.map((t) => (
              <Card key={t.id} hover className="cursor-pointer" onClick={() => openDesign(t)}>
                {t.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.thumbnail} alt={t.name} className="mb-2 h-28 w-full rounded-lg object-cover ring-1 ring-slate-100" />
                ) : (
                  <div className="mb-2 flex h-28 w-full items-center justify-center rounded-lg bg-primary-50 text-primary-400"><Palette className="h-6 w-6" /></div>
                )}
                <h3 className="font-semibold text-slate-900">{t.name}</h3>
                <p className="mt-0.5 text-xs text-slate-400">{t.industry ?? 'All industries'}</p>
              </Card>
            ))}
          </div>
          {!designLoading && designTemplates.length === 0 && (
            <p className="text-xs text-slate-400">More ready-made design templates are on the way — for now, pick a business document above to fill in and download.</p>
          )}
        </div>
      )}

      {/* ── MODE: LIBRARY ─────────────────────────────────────────────────── */}
      {mode === 'library' && (
        library.length === 0 ? (
          <EmptyState icon="Library" title="Your library is empty" subtitle="Saved generations show up here." />
        ) : (
          <div className="space-y-3">
            {library.map((item) => (
              <Card key={item.id}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900"><Library className="h-4 w-4 text-primary-600" />{item.typeLabel}</span>
                  <span className="text-xs text-slate-400">{new Date(item.createdAt).toLocaleDateString('en-IN')}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-slate-600">{item.content}</p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" leftIcon={<Download className="h-4 w-4" />} onClick={() => download(item.content, item.typeLabel)}>Download</Button>
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      {/* Generation flow (AI Generate) */}
      <Modal isOpen={active !== null} onClose={() => setActive(null)} title={active ? `Generate ${active.label}` : ''} maxWidth="max-w-2xl">
        {active && (
          <div className="space-y-4">
            {templates.length > 0 && (
              <div className="rounded-xl border border-primary-100 bg-primary-50/40 p-3">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-primary-700"><Library className="h-3.5 w-3.5" /> Start from a template</div>
                <div className="flex flex-wrap gap-2">
                  {templates.map((t) => (
                    <button key={t.id} type="button"
                      onClick={() => { setDetails(t.prompt); if (!purpose) setPurpose(t.name); }}
                      className="rounded-lg border border-primary-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-primary-400 hover:bg-primary-50">
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <Input label="Purpose / Occasion" placeholder="e.g. Diwali offer, new service launch" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
            <Select label="Tone" value={tone} onChange={(e) => setTone(e.target.value)}>
              {TONES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
            <Textarea label="Key details" placeholder="What should this content say?" value={details} onChange={(e) => setDetails(e.target.value)} />

            {IMAGE_TYPES.has(active.key) && (
              <div className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">Your own image <span className="font-normal text-slate-400">(optional)</span></div>
                    <div className="text-xs text-slate-400">Use a real product/property photo or your logo instead of AI imagery.</div>
                  </div>
                  <label className="flex-shrink-0 cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-primary-300 hover:text-primary-700">
                    {uploading ? 'Uploading…' : uploadImg ? 'Change' : 'Upload'}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadContentImage(f); }} />
                  </label>
                </div>
                {uploadImg && (
                  <div className="mt-3 flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={uploadImg} alt="Your upload" className="h-14 w-14 rounded-lg border border-slate-200 object-cover" />
                    <span className="text-xs text-success-600">Will be used instead of an AI image.</span>
                    <button onClick={() => setUploadImg(null)} className="ml-auto text-xs font-medium text-slate-500 hover:text-error-600">Remove</button>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between rounded-xl bg-primary-50 px-4 py-2.5">
              <span className="text-sm text-primary-700">Estimated cost</span>
              <span className="text-sm font-bold text-primary-700">{isInternalStaff ? 'Free (internal)' : `~₹${active.cost}`}</span>
            </div>

            {genError && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <p>{genError}</p>
                <div className="mt-2 flex gap-2">
                  {/wallet|balance|low/i.test(genError)
                    ? <Link href="/dashboard/wallet" className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white">Top Up Wallet</Link>
                    : <Link href="/dashboard/support" className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white">Contact Support</Link>}
                </div>
              </div>
            )}

            {result && (
              <div>
                <div className="mb-1.5 text-sm font-medium text-slate-700">Result</div>
                {resultImg && (
                  <div className="mb-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={resultImg} alt="Content" className="max-h-64 w-full rounded-xl border border-slate-200 object-contain" />
                    <a href={resultImg} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary-600"><Download className="h-3 w-3" /> Open / download image</a>
                  </div>
                )}
                <Textarea value={result} onChange={(e) => setResult(e.target.value)} className="min-h-[160px]" />
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              {result ? (
                <>
                  <Button variant="outline" leftIcon={<RefreshCw className="h-4 w-4" />} loading={generating} onClick={generate}>Regenerate</Button>
                  <Button variant="outline" leftIcon={<Download className="h-4 w-4" />} onClick={() => download(result, active.label)}>Download</Button>
                  <Button variant="outline" leftIcon={<Share2 className="h-4 w-4" />} onClick={shareResult}>Share</Button>
                  <Button leftIcon={<Save className="h-4 w-4" />} onClick={saveToLibrary}>Save to Library</Button>
                </>
              ) : (
                <Button leftIcon={<Sparkles className="h-4 w-4" />} loading={generating} onClick={generate}>{isInternalStaff ? 'Generate' : `Generate (~₹${active.cost})`}</Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Business-document generator (coded template → backend render → print-to-PDF) */}
      <Modal isOpen={docSel !== null} onClose={() => setDocSel(null)} title={docSel?.label ?? ''} maxWidth="max-w-3xl">
        {docSel && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {docSel.fields.map((f) => (
                <Input key={f.key} label={f.label + (f.required ? ' *' : '')} maxLength={f.maxLength}
                  value={docValues[f.key] ?? ''} onChange={(e) => setDocValues((v) => ({ ...v, [f.key]: e.target.value }))} />
              ))}
              <Input label="Logo URL (optional)" placeholder="https://…/logo.png" value={docLogo} onChange={(e) => setDocLogo(e.target.value)} />
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Preview</span>
                {docBusy && <span className="text-xs text-slate-400">Updating…</span>}
              </div>
              <div className="overflow-x-auto rounded-lg bg-white p-4" dangerouslySetInnerHTML={{ __html: docPreview }} />
            </div>
            <div className="flex justify-end">
              <Button leftIcon={<Download className="h-4 w-4" />} disabled={!docPreview} onClick={printDoc}>Download / Print as PDF</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Design-template data-fill (generation runs once the design account is connected) */}
      <Modal isOpen={designSel !== null} onClose={() => setDesignSel(null)} title={designSel?.name ?? ''} maxWidth="max-w-2xl">
        {designSel && (
          <div className="space-y-4">
            {designSel.thumbnail && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={designSel.thumbnail} alt={designSel.name} className="max-h-56 w-full rounded-xl border border-slate-200 object-contain" />
            )}
            {(designSel.fields ?? []).map((f) => (
              <Input key={f.key} label={f.label} maxLength={f.maxLength}
                value={designValues[f.key] ?? ''} onChange={(e) => setDesignValues((v) => ({ ...v, [f.key]: e.target.value }))} />
            ))}
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              This template isn’t ready to generate yet — your Get4Domain team is finishing the design setup.
              Your details are saved, and generation lights up as soon as it’s connected.
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDesignSel(null)}>Close</Button>
              <Button disabled leftIcon={<ExternalLink className="h-4 w-4" />}>Generate (coming soon)</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Video / Reel generator */}
      <Modal isOpen={videoOpen} onClose={closeVideo} title="Generate Reel / Video" maxWidth="max-w-2xl">
        <div className="space-y-4">
          {videoProvider === 'none' ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Video generation isn&apos;t configured yet. An admin can add a Runway ML or HeyGen key in
              Admin → Integrations → Video. You can still preview the flow below with a sample clip.
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Provider: <span className="font-semibold text-slate-700">{videoProvider === 'heygen' ? 'HeyGen (avatar presenter)' : 'Runway ML (generative reel)'}</span>
            </p>
          )}

          {videoProvider === 'heygen' ? (
            <Textarea label="Script (what the presenter says)" placeholder="Hi! This Diwali, visit Ravi Sweets for 20% off all boxes…" value={videoInput} onChange={(e) => setVideoInput(e.target.value)} className="min-h-[120px]" />
          ) : (
            <Textarea label="Visual prompt" placeholder="Warm festive Diwali reel of a sweet shop, sparklers, golden light, slow pan" value={videoInput} onChange={(e) => setVideoInput(e.target.value)} className="min-h-[120px]" />
          )}

          <div className="flex items-center justify-between rounded-xl bg-primary-50 px-4 py-2.5">
            <span className="text-sm text-primary-700">Estimated cost</span>
            <span className="text-sm font-bold text-primary-700">{isInternalStaff ? 'Free (internal)' : videoProvider === 'none' ? 'Free (mock)' : `~₹${(videoCost / 100).toFixed(0)}`}</span>
          </div>

          {videoError && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <p>{videoError}</p>
              {/wallet|balance|low/i.test(videoError) && (
                <Link href="/dashboard/wallet" className="mt-2 inline-block rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white">Top Up Wallet</Link>
              )}
            </div>
          )}

          {videoUrl && (
            <div>
              <div className="mb-1.5 text-sm font-medium text-slate-700">Result</div>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video src={videoUrl} controls className="w-full rounded-xl border border-slate-200" />
              <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600"><Download className="h-4 w-4" /> Download / open</a>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={closeVideo}>Close</Button>
            <Button leftIcon={<Video className="h-4 w-4" />} loading={videoBusy} disabled={!videoInput.trim() || videoBusy} onClick={generateVideo}>
              {videoBusy ? 'Generating…' : videoUrl ? 'Regenerate' : 'Generate video'}
            </Button>
          </div>
          {videoBusy && <p className="text-center text-xs text-slate-400">Rendering your video — this can take up to a minute.</p>}
        </div>
      </Modal>
    </div>
  );
}
