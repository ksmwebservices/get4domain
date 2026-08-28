'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  Sparkles, Wand2, MessageSquare, Video, FileText, Image as ImageIcon,
  Megaphone, Mail, MessageCircle, Smartphone, Download, Save, FolderOpen, Wallet, Share2,
  Palette, CreditCard, IdCard, LayoutGrid, Search, Clock, RotateCcw,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import Modal from '@/components/ui/Modal';
import { Input, Textarea, Select } from '@/components/ui/Input';

// The design editor (Fabric.js) is browser-only — load it client-side only.
const FabricEditor = dynamic(() => import('@/components/design/FabricEditor'), {
  ssr: false,
  loading: () => <div className="flex h-[70vh] items-center justify-center text-sm text-ink-400">Loading editor…</div>,
});

interface ContentType { key: string; label: string; icon: typeof Sparkles }

// An editable design template (Fabric scene) — from GET /design/templates or admin-authored.
interface EditorTemplate {
  id: string; name: string; category: string; width: number; height: number;
  fields: { key: string; label: string; prefillFrom?: 'businessName' | 'name' | 'email' }[];
  editorJson: Record<string, unknown>;
}

// Costs come from the backend rate table (/ai/costs) — this list is only labels/icons/order.
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

interface TemplateCategory {
  key: string; label: string; icon: typeof Sparkles; kind: 'document' | 'design';
  docKey?: string; costKey?: string; blurb: string; gradient: string;
}
const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  { key: 'business_card', label: 'Business Card', icon: CreditCard, kind: 'document', docKey: 'visiting_card', blurb: 'Double-sided visiting card', gradient: 'from-brand-600 to-brand-900' },
  { key: 'letterhead', label: 'Letterhead', icon: FileText, kind: 'document', docKey: 'letterhead', blurb: 'Branded company header', gradient: 'from-ink-700 to-brand-900' },
  { key: 'id_card', label: 'ID Card', icon: IdCard, kind: 'document', docKey: 'id_card', blurb: 'Staff identity card', gradient: 'from-brand-500 to-ink-900' },
  { key: 'poster', label: 'Poster', icon: ImageIcon, kind: 'design', costKey: 'festival_poster', blurb: 'Promo & festival posters', gradient: 'from-gold-500 to-ruby-600' },
  { key: 'flyer', label: 'Flyer', icon: FileText, kind: 'design', costKey: 'festival_poster', blurb: 'Single-page flyers', gradient: 'from-ruby-600 to-brand-800' },
  { key: 'brochure', label: 'Brochure', icon: FileText, kind: 'design', costKey: 'social_post', blurb: 'Multi-panel brochures', gradient: 'from-gold-400 to-gold-700' },
  { key: 'social_graphic', label: 'Social Graphic', icon: MessageSquare, kind: 'design', costKey: 'social_post', blurb: 'Posts & story graphics', gradient: 'from-success to-brand-700' },
];

const TONES = ['Professional', 'Friendly', 'Excited', 'Formal', 'Playful'];
const IMAGE_TYPES = new Set(['social_post', 'festival_poster', 'ad_creative']);

const PROMPT_SUGGESTIONS = [
  'Create a festive Diwali offer post — 20% off, warm and premium tone',
  'Write an Instagram caption for our new arrivals with a minimal aesthetic',
  'Draft a WhatsApp broadcast about our weekend special, friendly and short',
];

const DOC_ICON: Record<string, typeof FileText> = { letterhead: FileText, visiting_card: CreditCard, id_card: IdCard };

interface FieldDef { key: string; label: string; type?: 'text' | 'textarea'; required?: boolean; maxLength?: number; prefillFrom?: 'businessName' | 'name' | 'email' }
interface DocTemplate { key: string; label: string; description: string; fields: FieldDef[] }
interface SavedItem { id: string; type: string; typeLabel: string; content: string; createdAt: string }

type Tab = 'generate' | 'templates' | 'library';
const TABS: { key: Tab; label: string; icon: typeof Sparkles }[] = [
  { key: 'generate', label: 'AI Generate', icon: Wand2 },
  { key: 'templates', label: 'Templates', icon: LayoutGrid },
  { key: 'library', label: 'Library', icon: FolderOpen },
];

export default function AiStudioPage() {
  const { user } = useAuth();
  const isInternalStaff = user?.role === 'admin' || user?.role === 'super_admin';
  const [tab, setTab] = useState<Tab>('generate');

  // Composer state (inline Generate — real generation via /ai).
  const [format, setFormat] = useState<ContentType>(CONTENT_TYPES[0]);
  const [purpose, setPurpose] = useState('');
  const [tone, setTone] = useState(TONES[0]);
  const [details, setDetails] = useState('');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState('');
  const [genError, setGenError] = useState('');
  const [templates, setTemplates] = useState<{ id: string; name: string; prompt: string }[]>([]);
  const [library, setLibrary] = useState<SavedItem[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [uploadImg, setUploadImg] = useState<string | null>(null);
  const [resultImg, setResultImg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [librarySearch, setLibrarySearch] = useState('');

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

  const [costs, setCosts] = useState<Record<string, number>>({});
  useEffect(() => { api.aiCosts().then((r) => setCosts((r.data ?? {}) as Record<string, number>)).catch(() => setCosts({})); }, []);
  const costLabel = useCallback((key?: string): string => {
    if (isInternalStaff) return 'Free';
    if (key && costs[key] != null) return `~₹${Math.round(costs[key] / 100)}`;
    return 'wallet rate';
  }, [isInternalStaff, costs]);

  // ── Templates tab: category → gallery ──
  const [browseCat, setBrowseCat] = useState<TemplateCategory | null>(null);
  const [editorTemplates, setEditorTemplates] = useState<EditorTemplate[]>([]);
  const [editorLoaded, setEditorLoaded] = useState(false);
  const [editorTpl, setEditorTpl] = useState<EditorTemplate | null>(null);
  useEffect(() => {
    if (tab !== 'templates' || editorLoaded) return;
    setEditorLoaded(true);
    Promise.all([
      api.designTemplates().then((r) => (r.data ?? []) as EditorTemplate[]).catch(() => []),
      api.aiTemplates(`?source=design${user?.industry ? `&industry=${encodeURIComponent(user.industry)}` : ''}`).then((r) => (r.data ?? [])).catch(() => []),
    ]).then(([builtins, admin]) => {
      const mapped: EditorTemplate[] = (admin as Array<Record<string, unknown>>).filter((t) => t.editorJson).map((t) => {
        const ej = t.editorJson as Record<string, unknown>;
        return { id: t.id as string, name: t.name as string, category: (t.contentType as string) || 'poster', width: (ej.width as number) || 1080, height: (ej.height as number) || 1080, fields: (t.fields as EditorTemplate['fields']) || [], editorJson: ej };
      });
      setEditorTemplates([...builtins, ...mapped]);
    });
  }, [tab, editorLoaded, user?.industry]);

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

  // Business Documents
  const [docTemplates, setDocTemplates] = useState<DocTemplate[]>([]);
  const [docSel, setDocSel] = useState<DocTemplate | null>(null);
  const [docValues, setDocValues] = useState<Record<string, string>>({});
  const [docLogo, setDocLogo] = useState('');
  const [docPreview, setDocPreview] = useState('');
  const [docBusy, setDocBusy] = useState(false);
  useEffect(() => {
    if (tab !== 'templates' || docTemplates.length) return;
    api.businessDocTemplates().then((r) => setDocTemplates((r.data ?? []) as DocTemplate[])).catch(() => setDocTemplates([]));
  }, [tab, docTemplates.length]);
  const openDoc = (t: DocTemplate) => { setDocSel(t); setDocValues(prefill(t.fields)); setDocLogo(''); setDocPreview(''); };
  const renderDoc = useCallback(async () => {
    if (!docSel) return;
    setDocBusy(true);
    try { const r = await api.renderBusinessDocument({ type: docSel.key, values: docValues, brand: docLogo ? { logoUrl: docLogo } : undefined }); setDocPreview((r.data?.html as string) ?? ''); }
    catch { /* keep */ } finally { setDocBusy(false); }
  }, [docSel, docValues, docLogo]);
  useEffect(() => { if (!docSel) return; const t = setTimeout(renderDoc, 400); return () => clearTimeout(t); }, [docSel, docValues, docLogo, renderDoc]);
  const printDoc = () => {
    if (!docPreview) return;
    const w = window.open('', '_blank', 'width=820,height=1000'); if (!w) return;
    w.document.write(`<!doctype html><html><head><title>${docSel?.label ?? 'document'}</title><style>@media print{body{margin:0}}body{margin:24px;background:#fff}</style></head><body>${docPreview}<script>window.onload=function(){window.print();}</script></body></html>`);
    w.document.close();
  };

  // Video / Reel generation (Runway or HeyGen; async job)
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

  // Photo Reel (Remotion)
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
    catch (e) { setReelMsg(e instanceof Error ? e.message : 'Photo upload failed'); } finally { setReelUploading(false); }
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
    try { const res = await api.getVideoProvider(); setVideoProvider(res.data?.provider ?? 'none'); setVideoCost(res.data?.cost ?? 0); }
    catch { setVideoProvider('none'); setVideoCost(0); }
  };
  const closeVideo = () => { stopPolling(); setVideoOpen(false); };
  const generateVideo = async () => {
    setVideoBusy(true); setVideoUrl(null); setVideoError('');
    try {
      const payload = videoProvider === 'heygen' ? { script: videoInput } : { prompt: videoInput };
      const res = await api.generateVideo(payload);
      const { jobId, provider } = res.data ?? {};
      if (!jobId) throw new Error('Could not start the video job.');
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
    if (isInternalStaff) return;
    api.getWalletBalance().then((res) => setBalance(res.data?.balance ?? 0)).catch(() => setBalance(null));
  }, [isInternalStaff]);
  useEffect(() => { refreshBalance(); }, [refreshBalance]);
  const loadLibrary = useCallback(() => {
    if (typeof window === 'undefined') return;
    try { setLibrary(JSON.parse(localStorage.getItem(storageKey) ?? '[]')); } catch { setLibrary([]); }
  }, [storageKey]);
  useEffect(() => { loadLibrary(); }, [loadLibrary]);

  // Starting-point prompt templates for the selected content type.
  useEffect(() => {
    let cancelled = false;
    const q = `?source=prompt&contentType=${encodeURIComponent(format.key)}${user?.industry ? `&industry=${encodeURIComponent(user.industry)}` : ''}`;
    api.aiTemplates(q).then((res) => { if (!cancelled) setTemplates(res.data ?? []); }).catch(() => { if (!cancelled) setTemplates([]); });
    return () => { cancelled = true; };
  }, [format, user?.industry]);

  const uploadContentImage = async (file: File) => {
    setUploading(true); setGenError('');
    try { const r = await api.uploadImage(file); setUploadImg(r.data?.url ?? null); }
    catch (e) { setGenError(e instanceof Error ? e.message : 'Image upload failed'); } finally { setUploading(false); }
  };

  const pickFormat = (ct: ContentType) => { setFormat(ct); setResult(''); setResultImg(null); setGenError(''); setUploadImg(null); };

  const generate = async () => {
    setGenerating(true); setResult(''); setGenError('');
    try {
      const res = await api.generateAiContent({
        channel: format.key, vendorIndustry: user?.industry ?? 'general',
        offerDetails: `${purpose}. Details: ${details}`, tone, skipImage: !!uploadImg,
      });
      setResult(res.data?.caption ?? res.data?.content ?? res.data?.text ?? JSON.stringify(res.data));
      setResultImg(uploadImg ?? (res.data?.imageUrl as string | null) ?? null);
      refreshBalance();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'generation failed';
      if (/not configured|api key|gateway|unauthor/i.test(msg)) setGenError('AI Studio needs to be configured by your administrator. Please contact support.');
      else if (/wallet|insufficient|balance/i.test(msg)) setGenError('Your wallet balance is too low for this generation. Top up to continue.');
      else setGenError(`Could not generate right now: ${msg}. Please try again.`);
    } finally { setGenerating(false); }
  };

  const saveToLibrary = () => {
    if (!result) return;
    const item: SavedItem = { id: `ai_${Date.now()}`, type: format.key, typeLabel: format.label, content: result, createdAt: new Date().toISOString() };
    const next = [item, ...library]; setLibrary(next); localStorage.setItem(storageKey, JSON.stringify(next));
  };
  const download = (content: string, name: string) => {
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
    const a = document.createElement('a'); a.href = url; a.download = `${name}.txt`; a.click();
  };
  const shareResult = async () => {
    const nav = navigator as Navigator & { canShare?: (d?: unknown) => boolean };
    try {
      if (resultImg && typeof nav.share === 'function' && typeof nav.canShare === 'function') {
        try {
          const resp = await fetch(resultImg); const blob = await resp.blob();
          const file = new File([blob], 'get4domain.png', { type: blob.type || 'image/png' });
          if (nav.canShare({ files: [file] })) { await nav.share({ files: [file], text: result }); return; }
        } catch { /* fall through */ }
      }
      if (typeof nav.share === 'function') await nav.share({ title: 'Get4Domain', text: result });
      else { await navigator.clipboard.writeText(result); setGenError('Copied to clipboard — sharing isn’t supported on this browser.'); }
    } catch { /* cancelled */ }
  };

  const libraryGroups = useMemo(() => {
    const q = librarySearch.trim().toLowerCase();
    const items = q ? library.filter((i) => i.typeLabel.toLowerCase().includes(q) || i.content.toLowerCase().includes(q)) : library;
    const weekAgo = Date.now() - 7 * 86400000;
    return { 'This Week': items.filter((i) => new Date(i.createdAt).getTime() >= weekAgo), 'Earlier': items.filter((i) => new Date(i.createdAt).getTime() < weekAgo) };
  }, [library, librarySearch]);

  return (
    <div className="vendor-ui -m-5 min-h-[calc(100vh-4rem)] bg-ink-950 bg-radial-glow p-5 text-ink-100 lg:-m-8 lg:p-8">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-ink-50"><Sparkles className="h-5 w-5 text-gold-400" /> AI Studio</h1>
          <p className="text-sm text-ink-500">Create on-brand content, templates and documents</p>
        </div>
        {isInternalStaff ? (
          <span className="chip border border-success/25 bg-success/10 text-success"><Sparkles className="h-3.5 w-3.5" /> Free for internal team</span>
        ) : (
          <div className="flex items-center gap-2">
            <span className="chip border border-ink-700/50 bg-ink-850/60 text-ink-200"><Wallet className="h-3.5 w-3.5 text-gold-400" />{balance !== null ? `₹${(balance / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—'}</span>
            <Link href="/dashboard/wallet" className="btn-gold !px-3 !py-1.5 !text-xs">+ Top Up</Link>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-5 flex w-fit items-center gap-1 rounded-xl border border-ink-700/40 bg-ink-850/60 p-1">
        {TABS.map((t) => {
          const Ic = t.icon; const on = tab === t.key;
          return (
            <button key={t.key} onClick={() => { setTab(t.key); setBrowseCat(null); if (t.key === 'library') loadLibrary(); }}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-all sm:px-4 ${on ? 'bg-brand-600/20 text-brand-300 shadow-sm' : 'text-ink-400 hover:text-ink-200'}`}>
              <Ic className="h-4 w-4" /><span className="hidden sm:inline">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── GENERATE — composer + live preview ── */}
      {tab === 'generate' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 animate-fade-in">
          {/* Composer */}
          <div className="space-y-4 lg:col-span-2">
            <div className="card p-5">
              <div className="mb-1 flex items-center gap-2"><Wand2 className="h-4 w-4 text-gold-400" /><h3 className="text-sm font-bold text-ink-100">Describe your content</h3></div>
              <p className="mb-4 text-xs text-ink-500">Pick a format, tell the AI what you want. Be specific for best results.</p>

              <label className="mb-1.5 block text-xs font-semibold text-ink-400">Format</label>
              <div className="mb-4 grid grid-cols-2 gap-2">
                {CONTENT_TYPES.map((ct) => {
                  const Ic = ct.icon; const on = format.key === ct.key;
                  return (
                    <button key={ct.key} onClick={() => pickFormat(ct)}
                      className={`flex items-center gap-2 rounded-xl border p-2.5 text-left transition-all ${on ? 'border-brand-500/50 bg-brand-500/10 text-brand-200' : 'border-ink-700/40 bg-ink-900/40 text-ink-400 hover:border-ink-600'}`}>
                      <Ic className="h-4 w-4 shrink-0" />
                      <div className="min-w-0"><div className="truncate text-xs font-semibold">{ct.label}</div><div className="text-[10px] text-ink-500">{costLabel(ct.key)}</div></div>
                    </button>
                  );
                })}
              </div>

              <label className="mb-1.5 block text-xs font-semibold text-ink-400">Purpose / Occasion</label>
              <input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Diwali offer, new service launch" className="input mb-3" />

              <label className="mb-1.5 block text-xs font-semibold text-ink-400">Your prompt</label>
              <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={4}
                placeholder="e.g. Create a Diwali offer poster for my dental clinic with 20% off on teeth cleaning…" className="input resize-none" />

              <label className="mb-1.5 mt-3 block text-xs font-semibold text-ink-400">Tone</label>
              <select value={tone} onChange={(e) => setTone(e.target.value)} className="input">
                {TONES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>

              {templates.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-ink-600">Start from a template</div>
                  {templates.slice(0, 3).map((t) => (
                    <button key={t.id} onClick={() => { setDetails(t.prompt); if (!purpose) setPurpose(t.name); }}
                      className="flex w-full items-start gap-2 rounded-lg p-2 text-left text-xs text-ink-400 transition hover:bg-ink-800/60 hover:text-ink-200">
                      <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-gold-400" /><span>{t.name}</span>
                    </button>
                  ))}
                </div>
              )}
              {templates.length === 0 && (
                <div className="mt-3 space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-ink-600">Try a suggestion</div>
                  {PROMPT_SUGGESTIONS.map((s, i) => (
                    <button key={i} onClick={() => setDetails(s)} className="flex w-full items-start gap-2 rounded-lg p-2 text-left text-xs text-ink-400 transition hover:bg-ink-800/60 hover:text-ink-200">
                      <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-gold-400" /><span>{s}</span>
                    </button>
                  ))}
                </div>
              )}

              {IMAGE_TYPES.has(format.key) && (
                <div className="mt-3 rounded-xl border border-ink-700/40 bg-ink-900/40 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div><div className="text-xs font-semibold text-ink-200">Your own image <span className="font-normal text-ink-500">(optional)</span></div><div className="text-[11px] text-ink-500">Use a real photo/logo instead of AI imagery.</div></div>
                    <label className="shrink-0 cursor-pointer rounded-lg border border-ink-700/50 px-3 py-1.5 text-xs font-semibold text-ink-300 hover:border-brand-500/50 hover:text-brand-200">
                      {uploading ? 'Uploading…' : uploadImg ? 'Change' : 'Upload'}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadContentImage(f); }} />
                    </label>
                  </div>
                  {uploadImg && <div className="mt-2 flex items-center gap-2"><img src={uploadImg} alt="" className="h-12 w-12 rounded-lg border border-ink-700/50 object-cover" /><span className="text-[11px] text-success">Will be used instead of AI imagery.</span><button onClick={() => setUploadImg(null)} className="ml-auto text-[11px] font-medium text-ink-500 hover:text-ruby-400">Remove</button></div>}
                </div>
              )}

              <button onClick={generate} disabled={(!purpose && !details) || generating} className="btn-gold mt-4 w-full">
                {generating ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-950/30 border-t-ink-950" />Generating…</> : <><Sparkles className="h-4 w-4" />Generate {!isInternalStaff && `· ${costLabel(format.key)}`}</>}
              </button>
              <p className="mt-2 text-center text-[10px] text-ink-600">{isInternalStaff ? 'Free for the internal team' : `Wallet balance: ${balance !== null ? `₹${(balance / 100).toLocaleString('en-IN')}` : '—'}`}</p>
            </div>

            {/* More formats */}
            <div className="card p-4">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-ink-600">More formats</div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={openVideo} className="flex items-center gap-2 rounded-xl border border-ink-700/40 bg-ink-900/40 p-2.5 text-left text-ink-300 hover:border-ink-600"><Video className="h-4 w-4 shrink-0 text-gold-400" /><span className="text-xs font-semibold">Reel / Video</span></button>
                <button onClick={openReel} className="flex items-center gap-2 rounded-xl border border-ink-700/40 bg-ink-900/40 p-2.5 text-left text-ink-300 hover:border-ink-600"><Video className="h-4 w-4 shrink-0 text-brand-300" /><span className="text-xs font-semibold">Photo Reel</span></button>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="lg:col-span-3">
            <div className="card flex h-full flex-col p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold text-ink-100">Live Preview</h3>
                {result && <span className="chip border border-success/25 bg-success/10 text-success"><span className="h-1.5 w-1.5 rounded-full bg-success" />Ready</span>}
              </div>
              <div className="flex flex-1 items-center justify-center">
                {!result && !generating && (
                  <div className="py-12 text-center">
                    <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl border border-ink-700/40 bg-ink-800/60"><Sparkles className="h-8 w-8 text-ink-600" /></div>
                    <p className="text-sm font-medium text-ink-400">Your preview will appear here</p>
                    <p className="mt-1 text-xs text-ink-600">Pick a format, write a prompt and hit Generate</p>
                  </div>
                )}
                {generating && (
                  <div className="py-12 text-center">
                    <div className="relative mx-auto mb-4 h-24 w-24">
                      <div className="absolute inset-0 animate-ping rounded-3xl bg-gold-500/10" />
                      <div className="absolute inset-0 flex items-center justify-center rounded-3xl border border-gold-500/30 bg-gold-500/15"><Sparkles className="h-8 w-8 animate-pulse text-gold-400" /></div>
                    </div>
                    <p className="text-sm font-medium text-ink-300">AI is creating your content…</p>
                    <p className="mt-1 text-xs text-ink-600">Crafting your {format.label.toLowerCase()}</p>
                  </div>
                )}
                {result && !generating && (
                  <div className="w-full animate-scale-in space-y-3">
                    {resultImg && (
                      <div><img src={resultImg} alt="" className="max-h-72 w-full rounded-2xl border border-ink-700/40 object-contain" /><a href={resultImg} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand-300"><Download className="h-3 w-3" /> Open / download image</a></div>
                    )}
                    <textarea value={result} onChange={(e) => setResult(e.target.value)} className="input min-h-[220px] resize-none leading-relaxed" />
                  </div>
                )}
              </div>

              {genError && (
                <div className="mt-3 rounded-xl border border-gold-500/30 bg-gold-500/10 px-4 py-3 text-sm text-gold-200">
                  <p>{genError}</p>
                  <div className="mt-2">{/wallet|balance|low/i.test(genError) ? <Link href="/dashboard/wallet" className="btn-gold !px-3 !py-1.5 !text-xs">Top Up Wallet</Link> : <Link href="/dashboard/support" className="btn-gold !px-3 !py-1.5 !text-xs">Contact Support</Link>}</div>
                </div>
              )}

              {result && !generating && (
                <div className="mt-4 flex items-center gap-2 border-t border-ink-700/30 pt-4 animate-fade-in">
                  <button onClick={generate} className="btn-ghost flex-1"><RotateCcw className="h-4 w-4" />Regenerate</button>
                  <button onClick={() => download(result, format.label)} className="btn-ghost flex-1"><Download className="h-4 w-4" />Download</button>
                  <button onClick={saveToLibrary} className="btn-ghost flex-1"><Save className="h-4 w-4" />Save</button>
                  <button onClick={shareResult} className="btn-primary flex-1"><Share2 className="h-4 w-4" />Share</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TEMPLATES — category cards → gallery ── */}
      {tab === 'templates' && (
        browseCat === null ? (
          <div className="space-y-4 animate-fade-in">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {TEMPLATE_CATEGORIES.map((cat) => {
                const Ic = cat.icon; const price = cat.kind === 'document' ? 'Free' : costLabel(cat.costKey);
                return (
                  <button key={cat.key} onClick={() => setBrowseCat(cat)} className="group text-left">
                    <div className={`relative aspect-[3/4] overflow-hidden rounded-2xl bg-gradient-to-br ${cat.gradient} shadow-card transition-all group-hover:-translate-y-1 group-hover:shadow-card-hover`}>
                      <div className="absolute inset-0 bg-grid-faint bg-[size:16px_16px] opacity-20" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                      <span className="absolute left-2 top-2 chip border border-white/20 bg-black/30 text-[10px] text-white backdrop-blur-md">{cat.kind === 'document' ? 'Free · PDF' : price}</span>
                      <div className="absolute inset-x-0 bottom-0 p-3">
                        <div className="mb-1.5 flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm"><Ic className="h-5 w-5 text-white" /></div>
                        <p className="text-sm font-bold text-white">{cat.label}</p>
                        <p className="text-[11px] text-white/70">{cat.blurb}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-4 animate-fade-in">
            <button onClick={() => setBrowseCat(null)} className="inline-flex items-center gap-1 text-sm font-medium text-brand-300 hover:text-brand-200">← All templates</button>
            <h2 className="text-lg font-bold text-ink-100">{browseCat.label}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {browseCat.docKey && (() => {
                const dt = docTemplates.find((d) => d.key === browseCat.docKey); if (!dt) return null;
                const Ic = DOC_ICON[dt.key] ?? FileText;
                return (
                  <button key={dt.key} onClick={() => openDoc(dt)} className="group text-left">
                    <div className="relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 to-brand-900 shadow-card transition-all group-hover:-translate-y-1 group-hover:shadow-card-hover">
                      <div className="absolute inset-0 bg-grid-faint bg-[size:16px_16px] opacity-20" />
                      <Ic className="h-10 w-10 text-white/90" />
                      <span className="absolute left-2 top-2 chip border border-white/20 bg-black/30 text-[10px] text-white backdrop-blur-md">Free · PDF</span>
                      <p className="absolute inset-x-0 bottom-0 p-3 text-sm font-bold text-white">{dt.label}</p>
                    </div>
                  </button>
                );
              })()}
              {editorTemplates.filter((t) => t.category === browseCat.key).map((t) => (
                <button key={t.id} onClick={() => openEditor(t)} className="group text-left">
                  <div className="relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-gold-500 to-ruby-600 shadow-card transition-all group-hover:-translate-y-1 group-hover:shadow-card-hover">
                    <div className="absolute inset-0 bg-grid-faint bg-[size:16px_16px] opacity-20" />
                    <Palette className="h-10 w-10 text-white/90" />
                    <span className="absolute left-2 top-2 chip border border-white/20 bg-black/30 text-[10px] text-white backdrop-blur-md">Editable</span>
                    <p className="absolute inset-x-0 bottom-0 p-3 text-sm font-bold text-white">{t.name}</p>
                  </div>
                </button>
              ))}
            </div>
            <p className="text-xs text-ink-500">Editable templates open an in-app design editor — drag, edit and export PNG/PDF. Business documents are one-click PDFs.</p>
          </div>
        )
      )}

      {/* ── LIBRARY — search + date-grouped ── */}
      {tab === 'library' && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex items-center justify-between gap-3">
            <div className="relative max-w-xs flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
              <input value={librarySearch} onChange={(e) => setLibrarySearch(e.target.value)} placeholder="Search your library…" className="input !pl-9 !text-xs" />
            </div>
            <span className="chip border border-ink-700/50 bg-ink-850/60 text-ink-300"><FolderOpen className="h-3 w-3" />{library.length} items</span>
          </div>
          {library.length === 0 ? (
            <div className="card flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-ink-700/40 bg-ink-800/60"><FolderOpen className="h-7 w-7 text-ink-600" /></div>
              <p className="text-sm font-semibold text-ink-200">Your library is empty</p>
              <p className="mt-1 text-xs text-ink-500">Generate something and Save — it shows up here.</p>
            </div>
          ) : (
            (Object.entries(libraryGroups) as [string, SavedItem[]][]).filter(([, items]) => items.length > 0).map(([period, items]) => (
              <div key={period}>
                <div className="mb-3 flex items-center gap-2"><Clock className="h-3.5 w-3.5 text-ink-600" /><h3 className="text-xs font-bold uppercase tracking-wider text-ink-400">{period}</h3></div>
                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={item.id} className="card p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-100"><Sparkles className="h-4 w-4 text-gold-400" />{item.typeLabel}</span>
                        <span className="text-xs text-ink-500">{new Date(item.createdAt).toLocaleDateString('en-IN')}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-ink-300">{item.content}</p>
                      <div className="mt-3 flex gap-2">
                        <button onClick={() => download(item.content, item.typeLabel)} className="btn-ghost !py-1.5 !px-3 !text-xs"><Download className="h-3.5 w-3.5" />Download</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Business-document generator */}
      <Modal skin="dark" isOpen={docSel !== null} onClose={() => setDocSel(null)} title={docSel?.label ?? ''} maxWidth="max-w-3xl">
        {docSel && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {docSel.fields.map((f) => (
                <Input skin="dark" key={f.key} label={f.label + (f.required ? ' *' : '')} maxLength={f.maxLength} value={docValues[f.key] ?? ''} onChange={(e) => setDocValues((v) => ({ ...v, [f.key]: e.target.value }))} />
              ))}
              <Input skin="dark" label="Logo URL (optional)" placeholder="https://…/logo.png" value={docLogo} onChange={(e) => setDocLogo(e.target.value)} />
            </div>
            <div className="rounded-xl border border-ink-700/40 bg-ink-900/40 p-4">
              <div className="mb-2 flex items-center justify-between"><span className="text-xs font-medium text-ink-500">Preview</span>{docBusy && <span className="text-xs text-ink-500">Updating…</span>}</div>
              <div className="overflow-x-auto rounded-lg bg-white p-4" dangerouslySetInnerHTML={{ __html: docPreview }} />
            </div>
            <div className="flex justify-end"><button onClick={printDoc} disabled={!docPreview} className="btn-primary disabled:opacity-50"><Download className="h-4 w-4" />Download / Print as PDF</button></div>
          </div>
        )}
      </Modal>

      {/* In-app design editor */}
      <Modal skin="dark" isOpen={editorTpl !== null} onClose={() => setEditorTpl(null)} title={editorTpl?.name ?? ''} maxWidth="max-w-5xl">
        {editorTpl && <FabricEditor mode="vendor" width={editorTpl.width} height={editorTpl.height} scene={editorTpl.editorJson} prefill={editorPrefill} fileName={editorTpl.name.toLowerCase().replace(/\s+/g, '-')} onClose={() => setEditorTpl(null)} />}
      </Modal>

      {/* Video / Reel generator */}
      <Modal skin="dark" isOpen={videoOpen} onClose={closeVideo} title="Generate Reel / Video" maxWidth="max-w-2xl">
        <div className="space-y-4">
          {videoProvider === 'none' ? (
            <div className="rounded-xl border border-gold-500/30 bg-gold-500/10 px-4 py-3 text-sm text-gold-200">Video generation isn&apos;t configured yet. An admin can add a Runway ML or HeyGen key in Admin → Integrations → Video.</div>
          ) : (
            <p className="text-sm text-ink-400">Provider: <span className="font-semibold text-ink-200">{videoProvider === 'heygen' ? 'HeyGen (avatar presenter)' : 'Runway ML (generative reel)'}</span></p>
          )}
          {videoProvider === 'heygen'
            ? <Textarea skin="dark" label="Script (what the presenter says)" placeholder="Hi! This Diwali, visit Ravi Sweets for 20% off…" value={videoInput} onChange={(e) => setVideoInput(e.target.value)} className="min-h-[120px]" />
            : <Textarea skin="dark" label="Visual prompt" placeholder="Warm festive Diwali reel, sparklers, golden light, slow pan" value={videoInput} onChange={(e) => setVideoInput(e.target.value)} className="min-h-[120px]" />}
          <div className="flex items-center justify-between rounded-xl border border-brand-500/20 bg-brand-500/10 px-4 py-2.5"><span className="text-sm text-brand-200">Estimated cost</span><span className="text-sm font-bold text-brand-200">{isInternalStaff ? 'Free (internal)' : videoProvider === 'none' ? 'Free (mock)' : `~₹${(videoCost / 100).toFixed(0)}`}</span></div>
          {videoError && <div className="rounded-xl border border-gold-500/30 bg-gold-500/10 px-4 py-3 text-sm text-gold-200"><p>{videoError}</p>{/wallet|balance|low/i.test(videoError) && <Link href="/dashboard/wallet" className="btn-gold mt-2 !px-3 !py-1.5 !text-xs">Top Up Wallet</Link>}</div>}
          {videoUrl && <div><div className="mb-1.5 text-sm font-medium text-ink-300">Result</div>{/* eslint-disable-next-line jsx-a11y/media-has-caption */}<video src={videoUrl} controls className="w-full rounded-xl border border-ink-700/40" /><a href={videoUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-300"><Download className="h-4 w-4" /> Download / open</a></div>}
          <div className="flex justify-end gap-2 pt-2"><button onClick={closeVideo} className="btn-ghost">Close</button><button onClick={generateVideo} disabled={!videoInput.trim() || videoBusy} className="btn-primary disabled:opacity-50"><Video className="h-4 w-4" />{videoBusy ? 'Generating…' : videoUrl ? 'Regenerate' : 'Generate video'}</button></div>
          {videoBusy && <p className="text-center text-xs text-ink-500">Rendering your video — this can take up to a minute.</p>}
        </div>
      </Modal>

      {/* Photo Reel builder */}
      <Modal skin="dark" isOpen={reelOpen} onClose={() => setReelOpen(false)} title="Photo Reel" maxWidth="max-w-2xl">
        <div className="space-y-4">
          <p className="text-sm text-ink-400">Add your own photos, a line of text and (optionally) a music track — we render a short reel you can post.</p>
          <div>
            <div className="mb-1.5 text-sm font-medium text-ink-300">Photos {reelImages.length > 0 && <span className="text-ink-500">({reelImages.length})</span>}</div>
            <div className="flex flex-wrap gap-2">
              {reelImages.map((src, i) => (
                <div key={i} className="relative"><img src={src} alt="" className="h-16 w-16 rounded-lg border border-ink-700/40 object-cover" /><button onClick={() => setReelImages((imgs) => imgs.filter((_, j) => j !== i))} className="absolute -right-1.5 -top-1.5 rounded-full bg-ink-700 px-1 text-[10px] font-bold text-white">×</button></div>
              ))}
              <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-lg border border-dashed border-ink-600 text-xs font-medium text-ink-400 hover:border-brand-500/50 hover:text-brand-200">{reelUploading ? '…' : '+ Add'}<input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) addReelPhoto(f); e.target.value = ''; }} /></label>
            </div>
          </div>
          <Input skin="dark" label="Text overlay (optional)" placeholder="e.g. Diwali Special — 20% off" value={reelText} onChange={(e) => setReelText(e.target.value)} />
          <Select skin="dark" label="Music" value={reelTrack} onChange={(e) => setReelTrack(e.target.value)}>
            <option value="">No music (silent reel)</option>
            {reelTracks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
          {reelTracks.length === 0 && <p className="-mt-2 text-xs text-ink-500">Licensed music tracks are added by your Get4Domain team — until then reels are silent.</p>}
          {reelMsg && <div className="rounded-xl border border-gold-500/30 bg-gold-500/10 px-4 py-3 text-sm text-gold-200">{reelMsg}</div>}
          {reelUrl && <div><div className="mb-1.5 text-sm font-medium text-ink-300">Result</div>{/* eslint-disable-next-line jsx-a11y/media-has-caption */}<video src={reelUrl} controls className="w-full rounded-xl border border-ink-700/40" /><a href={reelUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-300"><Download className="h-4 w-4" /> Download / open</a></div>}
          <div className="flex justify-end gap-2 pt-2"><button onClick={() => setReelOpen(false)} className="btn-ghost">Close</button><button onClick={createReel} disabled={reelImages.length === 0 || reelBusy} className="btn-primary disabled:opacity-50"><Video className="h-4 w-4" />{reelBusy ? 'Rendering…' : reelUrl ? 'Re-render' : 'Create reel'}</button></div>
          {reelBusy && <p className="text-center text-xs text-ink-500">Rendering your reel — this can take a little while.</p>}
        </div>
      </Modal>
    </div>
  );
}
