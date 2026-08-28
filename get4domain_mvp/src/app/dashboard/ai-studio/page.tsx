'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  Sparkles, MessageSquare, Video, FileText, Image as ImageIcon,
  Megaphone, Mail, MessageCircle, Smartphone, RefreshCw, Download, Save, Library, Wallet, Share2,
  Palette, CreditCard, IdCard,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { Input, Textarea, Select } from '@/components/ui/Input';
import EmptyState from '@/domainapp/shared/EmptyState';

// The design editor (Fabric.js) is browser-only — load it client-side only.
const FabricEditor = dynamic(() => import('@/components/design/FabricEditor'), {
  ssr: false,
  loading: () => <div className="flex h-[70vh] items-center justify-center text-sm text-slate-400">Loading editor…</div>,
});

interface ContentType {
  key: string;
  label: string;
  icon: typeof Sparkles;
}

// An editable design template (Fabric scene) — built-in from GET /design/templates
// or admin-authored (g4d_ai_templates, source='design').
interface EditorTemplate {
  id: string;
  name: string;
  category: string;
  width: number;
  height: number;
  fields: { key: string; label: string; prefillFrom?: 'businessName' | 'name' | 'email' }[];
  editorJson: Record<string, unknown>;
}

// Costs are NOT hardcoded here — they come from the backend rate table (/ai/costs,
// admin Pricing Manager + defaults), the single source of truth. This list is only
// the labels/icons/order of the showcase.
const CONTENT_TYPES: ContentType[] = [
  { key: 'social_post', label: 'Social Post', icon: MessageSquare },
  { key: 'reel_script', label: 'Reel Script', icon: Video },
  { key: 'blog_post', label: 'Blog Post', icon: FileText },
  { key: 'festival_poster', label: 'Festival Poster', icon: ImageIcon },
  { key: 'ad_creative', label: 'Ad Creative', icon: Megaphone },
  { key: 'email', label: 'Email Content', icon: Mail },
  { key: 'whatsapp', label: 'WhatsApp Message', icon: MessageCircle },
  { key: 'sms', label: 'SMS Text', icon: Smartphone },
];

// AI Template categories — browse by what you want to make. Business-document
// categories map to a coded template (Free, print-to-PDF); design categories map
// to synced design templates + staged placeholders, priced from the rate table via
// `costKey`. Adding real synced templates later is a data change, not a rebuild.
interface TemplateCategory {
  key: string;
  label: string;
  icon: typeof Sparkles;
  kind: 'document' | 'design';
  docKey?: string;   // for kind='document' → opens that coded business doc
  costKey?: string;  // for kind='design' → indicative price from the rate table
  blurb: string;
}
const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  { key: 'business_card', label: 'Business Card', icon: CreditCard, kind: 'document', docKey: 'visiting_card', blurb: 'Double-sided visiting card' },
  { key: 'letterhead', label: 'Letterhead', icon: FileText, kind: 'document', docKey: 'letterhead', blurb: 'Branded company header' },
  { key: 'id_card', label: 'ID Card', icon: IdCard, kind: 'document', docKey: 'id_card', blurb: 'Staff identity card' },
  { key: 'poster', label: 'Poster', icon: ImageIcon, kind: 'design', costKey: 'festival_poster', blurb: 'Promo & festival posters' },
  { key: 'flyer', label: 'Flyer', icon: FileText, kind: 'design', costKey: 'festival_poster', blurb: 'Single-page flyers' },
  { key: 'brochure', label: 'Brochure', icon: FileText, kind: 'design', costKey: 'social_post', blurb: 'Multi-panel brochures' },
  { key: 'social_graphic', label: 'Social Graphic', icon: MessageSquare, kind: 'design', costKey: 'social_post', blurb: 'Posts & story graphics' },
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

  // Per-use costs (paise) from the rate table — the single source of truth for the
  // showcase pricing (admin Pricing Manager overrides + defaults).
  const [costs, setCosts] = useState<Record<string, number>>({});
  useEffect(() => { api.aiCosts().then((r) => setCosts((r.data ?? {}) as Record<string, number>)).catch(() => setCosts({})); }, []);
  const costLabel = useCallback((key?: string): string => {
    if (isInternalStaff) return 'Free';
    if (key && costs[key] != null) return `~₹${Math.round(costs[key] / 100)}`;
    return 'wallet rate';
  }, [isInternalStaff, costs]);

  // AI Template browse: null = category grid; set = template gallery for that category.
  const [browseCat, setBrowseCat] = useState<TemplateCategory | null>(null);

  // Design editor (Fabric.js — MIT, no key). Templates = built-in samples
  // (/design/templates) + admin-authored (g4d_ai_templates, source='design').
  const [editorTemplates, setEditorTemplates] = useState<EditorTemplate[]>([]);
  const [editorLoaded, setEditorLoaded] = useState(false);
  const [editorTpl, setEditorTpl] = useState<EditorTemplate | null>(null);
  useEffect(() => {
    if (mode !== 'template' || editorLoaded) return;
    setEditorLoaded(true);
    Promise.all([
      api.designTemplates().then((r) => (r.data ?? []) as EditorTemplate[]).catch(() => []),
      api.aiTemplates(`?source=design${user?.industry ? `&industry=${encodeURIComponent(user.industry)}` : ''}`)
        .then((r) => (r.data ?? [])).catch(() => []),
    ]).then(([builtins, admin]) => {
      // Map admin AiTemplate rows → EditorTemplate (size lives inside editorJson).
      const mapped: EditorTemplate[] = (admin as Array<Record<string, unknown>>)
        .filter((t) => t.editorJson)
        .map((t) => {
          const ej = t.editorJson as Record<string, unknown>;
          return {
            id: t.id as string,
            name: t.name as string,
            category: (t.contentType as string) || 'poster',
            width: (ej.width as number) || 1080,
            height: (ej.height as number) || 1080,
            fields: (t.fields as EditorTemplate['fields']) || [],
            editorJson: ej,
          };
        });
      setEditorTemplates([...builtins, ...mapped]);
    });
  }, [mode, editorLoaded, user?.industry]);

  const openEditor = (t: EditorTemplate) => setEditorTpl(t);
  const editorPrefill = useMemo(() => {
    if (!editorTpl) return {};
    const map: Record<string, string> = {};
    for (const f of editorTpl.fields) {
      if (f.prefillFrom === 'businessName' && user?.businessName) map[f.key] = user.businessName;
      else if (f.prefillFrom === 'name' && user?.name) map[f.key] = user.name;
      else if (f.prefillFrom === 'email' && user?.email) map[f.key] = user.email;
    }
    return map;
  }, [editorTpl, user]);

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

  // ── Photo Reel (Remotion) — vendor's own photos + text + optional licensed music ──
  const [reelOpen, setReelOpen] = useState(false);
  const [reelImages, setReelImages] = useState<string[]>([]);
  const [reelText, setReelText] = useState('');
  const [reelTrack, setReelTrack] = useState('');
  const [reelTracks, setReelTracks] = useState<{ id: string; name: string }[]>([]);
  const [reelUploading, setReelUploading] = useState(false);
  const [reelBusy, setReelBusy] = useState(false);
  const [reelUrl, setReelUrl] = useState<string | null>(null);
  const [reelMsg, setReelMsg] = useState('');

  const openReel = async () => {
    setReelOpen(true); setReelImages([]); setReelText(''); setReelTrack(''); setReelUrl(null); setReelMsg('');
    try { const r = await api.reelTracks(); setReelTracks((r.data ?? []) as { id: string; name: string }[]); } catch { setReelTracks([]); }
  };
  const addReelPhoto = async (file: File) => {
    setReelUploading(true); setReelMsg('');
    try { const r = await api.uploadImage(file); if (r.data?.url) setReelImages((imgs) => [...imgs, r.data!.url]); }
    catch (e) { setReelMsg(e instanceof Error ? e.message : 'Photo upload failed'); }
    finally { setReelUploading(false); }
  };
  const createReel = async () => {
    if (reelImages.length === 0) return;
    setReelBusy(true); setReelUrl(null); setReelMsg('');
    try {
      const r = await api.renderReel({ images: reelImages, text: reelText || undefined, trackId: reelTrack || undefined });
      const status = r.data?.status as string | undefined;
      if (status === 'done' && r.data?.url) setReelUrl(r.data.url as string);
      else if (status === 'not_configured') setReelMsg(r.data?.message as string ?? 'The reel renderer isn’t set up on the server yet.');
      else setReelMsg(r.data?.message as string ?? 'Could not render the reel right now.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Reel render failed';
      setReelMsg(/wallet|insufficient|balance/i.test(msg) ? 'Your wallet balance is too low for a reel. Top up to continue.' : msg);
    } finally { setReelBusy(false); }
  };

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
    <div className="vendor-ui -m-5 min-h-[calc(100vh-4rem)] bg-ink-950 bg-radial-glow p-5 text-ink-100 lg:-m-8 lg:p-8">
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
            <button key={m.key} onClick={() => { setMode(m.key); setBrowseCat(null); if (m.key === 'library') loadLibrary(); }}
              className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-colors ${on ? 'border-primary-400 bg-primary-50 ring-1 ring-primary-500/50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
              <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${on ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-500'}`}><Ic className="h-5 w-5" /></span>
              <span className="min-w-0">
                <span className={`block text-sm font-bold ${on ? 'text-primary-800' : 'text-slate-800'}`}>{m.label}</span>
                <span className="mt-0.5 block text-xs text-slate-400">{m.blurb}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* ── MODE: AI GENERATE (showcase — pick a content type, see the per-use cost) ── */}
      {mode === 'ai' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
            <p className="text-sm font-semibold text-slate-700">Describe what you want — AI creates an original design</p>
            <p className="mt-0.5 text-xs text-slate-500">Pick a content type below. {isInternalStaff ? 'Free for the internal team.' : 'Per-use pricing is shown up front — you only pay when you generate.'}</p>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {CONTENT_TYPES.map((ct) => {
              const Ic = ct.icon;
              return (
                <Card skin="dark" key={ct.key} hover className="cursor-pointer" onClick={() => openType(ct)}>
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><Ic className="h-5 w-5" /></div>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{costLabel(ct.key)}</span>
                  </div>
                  <h3 className="mt-3 font-semibold text-slate-900">{ct.label}</h3>
                  <p className="mt-0.5 text-xs text-slate-400">{isInternalStaff ? 'Free' : 'per generation'}</p>
                </Card>
              );
            })}
            <Card skin="dark" hover className="cursor-pointer" onClick={openVideo}>
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><Video className="h-5 w-5" /></div>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{isInternalStaff ? 'Free' : 'wallet'}</span>
              </div>
              <h3 className="mt-3 font-semibold text-slate-900">Reel / Video</h3>
              <p className="mt-0.5 text-xs text-slate-400">{isInternalStaff ? 'Free' : 'per video'}</p>
            </Card>
            <Card skin="dark" hover className="cursor-pointer" onClick={openReel}>
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><Video className="h-5 w-5" /></div>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{isInternalStaff ? 'Free' : 'wallet'}</span>
              </div>
              <h3 className="mt-3 font-semibold text-slate-900">Photo Reel</h3>
              <p className="mt-0.5 text-xs text-slate-400">Your photos + music → MP4</p>
            </Card>
          </div>
        </div>
      )}

      {/* ── MODE: AI TEMPLATE (showcase — browse categories, then templates) ── */}
      {mode === 'template' && (
        browseCat === null ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
              <p className="text-sm font-semibold text-slate-700">Pick a ready-made template, fill in your details</p>
              <p className="mt-0.5 text-xs text-slate-500">Choose a category to browse designs. Business documents are free to download; design templates show their price up front.</p>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {TEMPLATE_CATEGORIES.map((cat) => {
                const Ic = cat.icon;
                const price = cat.kind === 'document' ? 'Free' : costLabel(cat.costKey);
                return (
                  <Card skin="dark" key={cat.key} hover className="cursor-pointer" onClick={() => setBrowseCat(cat)}>
                    <div className="flex items-center justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><Ic className="h-5 w-5" /></div>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{price}</span>
                    </div>
                    <h3 className="mt-3 font-semibold text-slate-900">{cat.label}</h3>
                    <p className="mt-0.5 text-xs text-slate-400">{cat.blurb}</p>
                  </Card>
                );
              })}
            </div>
          </div>
        ) : (
          // Gallery for a category — coded doc (Free · PDF) + editable design templates (in-app editor).
          <div className="space-y-4">
            <button onClick={() => setBrowseCat(null)} className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700">← All templates</button>
            <h2 className="text-lg font-bold text-slate-900">{browseCat.label}</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {/* Coded business document for this category — Free, instant PDF */}
              {browseCat.docKey && (() => {
                const dt = docTemplates.find((d) => d.key === browseCat.docKey);
                if (!dt) return null;
                const Ic = DOC_ICON[dt.key] ?? FileText;
                return (
                  <Card skin="dark" key={dt.key} hover className="cursor-pointer" onClick={() => openDoc(dt)}>
                    <div className="mb-2 flex h-28 w-full items-center justify-center rounded-lg bg-primary-50 text-primary-400"><Ic className="h-7 w-7" /></div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-900">{dt.label}</h3>
                      <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">Free · PDF</span>
                    </div>
                  </Card>
                );
              })()}
              {/* Editable design templates for this category — open the in-app editor */}
              {editorTemplates.filter((t) => t.category === browseCat.key).map((t) => (
                <Card skin="dark" key={t.id} hover className="cursor-pointer" onClick={() => openEditor(t)}>
                  <div className="mb-2 flex h-28 w-full items-center justify-center rounded-lg bg-gradient-to-br from-primary-100 to-teal-50 text-primary-500"><Palette className="h-7 w-7" /></div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900">{t.name}</h3>
                    <span className="rounded-full bg-primary-100 px-1.5 py-0.5 text-[10px] font-semibold text-primary-700">Editable</span>
                  </div>
                </Card>
              ))}
            </div>
            <p className="text-xs text-slate-400">Editable templates open in an in-app design editor — drag, edit and export a PNG or PDF. Business documents above are one-click PDFs.</p>
          </div>
        )
      )}

      {/* ── MODE: LIBRARY ─────────────────────────────────────────────────── */}
      {mode === 'library' && (
        library.length === 0 ? (
          <EmptyState icon="Library" title="Your library is empty" subtitle="Saved generations show up here." />
        ) : (
          <div className="space-y-3">
            {library.map((item) => (
              <Card skin="dark" key={item.id}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900"><Library className="h-4 w-4 text-primary-600" />{item.typeLabel}</span>
                  <span className="text-xs text-slate-400">{new Date(item.createdAt).toLocaleDateString('en-IN')}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-slate-600">{item.content}</p>
                <div className="mt-3 flex gap-2">
                  <Button skin="dark" size="sm" variant="outline" leftIcon={<Download className="h-4 w-4" />} onClick={() => download(item.content, item.typeLabel)}>Download</Button>
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      {/* Generation flow (AI Generate) */}
      <Modal skin="dark" isOpen={active !== null} onClose={() => setActive(null)} title={active ? `Generate ${active.label}` : ''} maxWidth="max-w-2xl">
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
            <Input skin="dark" label="Purpose / Occasion" placeholder="e.g. Diwali offer, new service launch" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
            <Select skin="dark" label="Tone" value={tone} onChange={(e) => setTone(e.target.value)}>
              {TONES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
            <Textarea skin="dark" label="Key details" placeholder="What should this content say?" value={details} onChange={(e) => setDetails(e.target.value)} />

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
              <span className="text-sm font-bold text-primary-700">{isInternalStaff ? 'Free (internal)' : costLabel(active.key)}</span>
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
                <Textarea skin="dark" value={result} onChange={(e) => setResult(e.target.value)} className="min-h-[160px]" />
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              {result ? (
                <>
                  <Button skin="dark" variant="outline" leftIcon={<RefreshCw className="h-4 w-4" />} loading={generating} onClick={generate}>Regenerate</Button>
                  <Button skin="dark" variant="outline" leftIcon={<Download className="h-4 w-4" />} onClick={() => download(result, active.label)}>Download</Button>
                  <Button skin="dark" variant="outline" leftIcon={<Share2 className="h-4 w-4" />} onClick={shareResult}>Share</Button>
                  <Button skin="dark" leftIcon={<Save className="h-4 w-4" />} onClick={saveToLibrary}>Save to Library</Button>
                </>
              ) : (
                <Button skin="dark" leftIcon={<Sparkles className="h-4 w-4" />} loading={generating} onClick={generate}>{isInternalStaff ? 'Generate' : `Generate (${costLabel(active.key)})`}</Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Business-document generator (coded template → backend render → print-to-PDF) */}
      <Modal skin="dark" isOpen={docSel !== null} onClose={() => setDocSel(null)} title={docSel?.label ?? ''} maxWidth="max-w-3xl">
        {docSel && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {docSel.fields.map((f) => (
                <Input skin="dark" key={f.key} label={f.label + (f.required ? ' *' : '')} maxLength={f.maxLength}
                  value={docValues[f.key] ?? ''} onChange={(e) => setDocValues((v) => ({ ...v, [f.key]: e.target.value }))} />
              ))}
              <Input skin="dark" label="Logo URL (optional)" placeholder="https://…/logo.png" value={docLogo} onChange={(e) => setDocLogo(e.target.value)} />
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Preview</span>
                {docBusy && <span className="text-xs text-slate-400">Updating…</span>}
              </div>
              <div className="overflow-x-auto rounded-lg bg-white p-4" dangerouslySetInnerHTML={{ __html: docPreview }} />
            </div>
            <div className="flex justify-end">
              <Button skin="dark" leftIcon={<Download className="h-4 w-4" />} disabled={!docPreview} onClick={printDoc}>Download / Print as PDF</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* In-app design editor (Fabric.js) — pickable template pre-filled with vendor data */}
      <Modal skin="dark" isOpen={editorTpl !== null} onClose={() => setEditorTpl(null)} title={editorTpl?.name ?? ''} maxWidth="max-w-5xl">
        {editorTpl && (
          <FabricEditor
            mode="vendor"
            width={editorTpl.width}
            height={editorTpl.height}
            scene={editorTpl.editorJson}
            prefill={editorPrefill}
            fileName={editorTpl.name.toLowerCase().replace(/\s+/g, '-')}
            onClose={() => setEditorTpl(null)}
          />
        )}
      </Modal>

      {/* Video / Reel generator */}
      <Modal skin="dark" isOpen={videoOpen} onClose={closeVideo} title="Generate Reel / Video" maxWidth="max-w-2xl">
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
            <Textarea skin="dark" label="Script (what the presenter says)" placeholder="Hi! This Diwali, visit Ravi Sweets for 20% off all boxes…" value={videoInput} onChange={(e) => setVideoInput(e.target.value)} className="min-h-[120px]" />
          ) : (
            <Textarea skin="dark" label="Visual prompt" placeholder="Warm festive Diwali reel of a sweet shop, sparklers, golden light, slow pan" value={videoInput} onChange={(e) => setVideoInput(e.target.value)} className="min-h-[120px]" />
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
            <Button skin="dark" variant="outline" onClick={closeVideo}>Close</Button>
            <Button skin="dark" leftIcon={<Video className="h-4 w-4" />} loading={videoBusy} disabled={!videoInput.trim() || videoBusy} onClick={generateVideo}>
              {videoBusy ? 'Generating…' : videoUrl ? 'Regenerate' : 'Generate video'}
            </Button>
          </div>
          {videoBusy && <p className="text-center text-xs text-slate-400">Rendering your video — this can take up to a minute.</p>}
        </div>
      </Modal>

      {/* Photo Reel builder — your own photos + text + optional licensed music → MP4 */}
      <Modal skin="dark" isOpen={reelOpen} onClose={() => setReelOpen(false)} title="Photo Reel" maxWidth="max-w-2xl">
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Add your own photos, a line of text and (optionally) a music track — we render a short reel you can post.</p>

          <div>
            <div className="mb-1.5 text-sm font-medium text-slate-700">Photos {reelImages.length > 0 && <span className="text-slate-400">({reelImages.length})</span>}</div>
            <div className="flex flex-wrap gap-2">
              {reelImages.map((src, i) => (
                <div key={i} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-16 w-16 rounded-lg border border-slate-200 object-cover" />
                  <button onClick={() => setReelImages((imgs) => imgs.filter((_, j) => j !== i))} className="absolute -right-1.5 -top-1.5 rounded-full bg-slate-700 px-1 text-[10px] font-bold text-white">×</button>
                </div>
              ))}
              <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs font-medium text-slate-500 hover:border-primary-400 hover:text-primary-700">
                {reelUploading ? '…' : '+ Add'}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) addReelPhoto(f); e.target.value = ''; }} />
              </label>
            </div>
          </div>

          <Input skin="dark" label="Text overlay (optional)" placeholder="e.g. Diwali Special — 20% off" value={reelText} onChange={(e) => setReelText(e.target.value)} />

          <Select skin="dark" label="Music" value={reelTrack} onChange={(e) => setReelTrack(e.target.value)}>
            <option value="">No music (silent reel)</option>
            {reelTracks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
          {reelTracks.length === 0 && <p className="-mt-2 text-xs text-slate-400">Licensed music tracks are added by your Get4Domain team — until then reels are silent.</p>}

          {reelMsg && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{reelMsg}</div>}

          {reelUrl && (
            <div>
              <div className="mb-1.5 text-sm font-medium text-slate-700">Result</div>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video src={reelUrl} controls className="w-full rounded-xl border border-slate-200" />
              <a href={reelUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600"><Download className="h-4 w-4" /> Download / open</a>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button skin="dark" variant="outline" onClick={() => setReelOpen(false)}>Close</Button>
            <Button skin="dark" leftIcon={<Video className="h-4 w-4" />} loading={reelBusy} disabled={reelImages.length === 0 || reelBusy} onClick={createReel}>
              {reelBusy ? 'Rendering…' : reelUrl ? 'Re-render' : 'Create reel'}
            </Button>
          </div>
          {reelBusy && <p className="text-center text-xs text-slate-400">Rendering your reel — this can take a little while.</p>}
        </div>
      </Modal>
    </div>
  );
}
