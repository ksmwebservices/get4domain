'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Sparkles, MessageSquare, Video, FileText, Image as ImageIcon,
  Megaphone, Mail, MessageCircle, Smartphone, RefreshCw, Download, Save, Library, Wallet,
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

// Document generators — simple HTML templates filled with the vendor's business
// data, downloaded via browser print-to-PDF. No wallet cost, no AI backend.
type DocKey = 'letterhead' | 'id_card' | 'visiting_card';
const DOC_TYPES: { key: DocKey; label: string; icon: string; desc: string }[] = [
  { key: 'letterhead', label: 'Letterhead', icon: '📄', desc: 'Company header — print to PDF' },
  { key: 'id_card', label: 'ID Card', icon: '🪪', desc: 'Employee ID — print to PDF' },
  { key: 'visiting_card', label: 'Visiting Card', icon: '💼', desc: 'Business card — print to PDF' },
];

interface DocFields { business: string; person: string; designation: string; phone: string; email: string; address: string }

function docHtml(kind: DocKey, f: DocFields, bg?: string | null): string {
  const brand = '#2563eb';
  const base = `font-family: Arial, Helvetica, sans-serif; color:#0f172a;`;
  // AI design as a background layer with a white wash so the REAL text stays crisp.
  const bgLayer = bg ? `background-image:linear-gradient(rgba(255,255,255,.85),rgba(255,255,255,.85)),url('${bg}');background-size:cover;background-position:center;` : '';
  if (kind === 'letterhead') {
    return `<div style="${base} ${bgLayer} max-width:720px;margin:0 auto;padding:0;">
      <div style="border-bottom:4px solid ${brand};padding:24px 32px;display:flex;justify-content:space-between;align-items:flex-end;">
        <div><div style="font-size:26px;font-weight:800;color:${brand};">${f.business}</div>
        <div style="font-size:12px;color:#475569;margin-top:4px;">${f.address}</div></div>
        <div style="text-align:right;font-size:12px;color:#475569;">${f.phone}<br/>${f.email}</div>
      </div>
      <div style="min-height:520px;padding:40px 32px;color:#94a3b8;font-size:13px;">Date: _____________<br/><br/>Dear _____________,<br/><br/>[ Your letter content here ]</div>
      <div style="border-top:1px solid #e2e8f0;padding:14px 32px;text-align:center;font-size:11px;color:#94a3b8;">${f.business} · ${f.phone} · ${f.email}</div>
    </div>`;
  }
  if (kind === 'id_card') {
    return `<div style="${base} width:320px;margin:0 auto;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.08);">
      <div style="background:${brand};color:#fff;padding:16px;text-align:center;font-weight:800;">${f.business}</div>
      <div style="${bgLayer} padding:20px;text-align:center;">
        <div style="width:96px;height:96px;border-radius:50%;background:#e2e8f0;margin:0 auto;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:12px;">PHOTO</div>
        <div style="font-size:18px;font-weight:700;margin-top:12px;">${f.person}</div>
        <div style="font-size:13px;color:${brand};">${f.designation}</div>
        <div style="font-size:12px;color:#475569;margin-top:10px;">${f.phone}<br/>${f.email}</div>
      </div>
      <div style="background:#f8fafc;padding:8px;text-align:center;font-size:10px;color:#94a3b8;">${f.address}</div>
    </div>`;
  }
  return `<div style="${base} display:flex;gap:20px;flex-wrap:wrap;justify-content:center;">
    <div style="${bgLayer} width:340px;height:190px;border-radius:12px;border:1px solid #e2e8f0;padding:20px;box-shadow:0 4px 16px rgba(0,0,0,.08);">
      <div style="font-size:20px;font-weight:800;color:${brand};">${f.business}</div>
      <div style="margin-top:26px;font-size:16px;font-weight:700;">${f.person}</div>
      <div style="font-size:12px;color:${brand};">${f.designation}</div>
      <div style="position:relative;margin-top:22px;font-size:11px;color:#475569;">${f.phone} · ${f.email}<br/>${f.address}</div>
    </div>
    <div style="width:340px;height:190px;border-radius:12px;background:${brand};color:#fff;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;">${f.business}</div>
  </div>`;
}

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
  const [tab, setTab] = useState<'create' | 'library'>('create');
  const [active, setActive] = useState<ContentType | null>(null);
  const [purpose, setPurpose] = useState('');
  const [tone, setTone] = useState(TONES[0]);
  const [details, setDetails] = useState('');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState('');
  const [genError, setGenError] = useState('');
  const [library, setLibrary] = useState<SavedItem[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [activeDoc, setActiveDoc] = useState<DocKey | null>(null);
  const [docFields, setDocFields] = useState<DocFields>({ business: '', person: '', designation: '', phone: '', email: '', address: '' });

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

  const [docBg, setDocBg] = useState<string | null>(null);
  const [docBgLoading, setDocBgLoading] = useState(false);
  const [docBgNote, setDocBgNote] = useState('');

  const generateDocBg = async () => {
    if (!activeDoc) return;
    setDocBgLoading(true); setDocBgNote('');
    const kindLabel = DOC_TYPES.find((d) => d.key === activeDoc)?.label ?? 'document';
    const prompt = `Elegant professional ${kindLabel.toLowerCase()} background design, subtle abstract geometric pattern in blue and white, clean corporate style, plenty of empty space, NO text, NO words, NO letters`;
    try {
      const res = await api.generateDesignImage(prompt);
      const url = res.data?.imageUrl as string | null | undefined;
      if (url) { setDocBg(url); return; }
      // Honest failure: distinguish "no key" from a real OpenAI API error.
      const status = res.data?.status as string | undefined;
      const err = res.data?.error as string | undefined;
      if (status === 'not_configured') setDocBgNote('AI image isn’t configured — add an OpenAI key in Admin → Integrations. Using the clean default design.');
      else setDocBgNote(`AI image failed: ${err ?? 'unknown error'}. Using the clean default design.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not generate design';
      setDocBgNote(/wallet|insufficient|balance/i.test(msg) ? 'Wallet balance too low for an AI design.' : 'Could not generate the design right now.');
    } finally {
      setDocBgLoading(false);
    }
  };

  const openDoc = (key: DocKey) => {
    setActiveDoc(key);
    setDocBg(null); setDocBgNote('');
    setDocFields({
      business: user?.businessName ?? 'Your Business',
      person: user?.name ?? '',
      designation: 'Proprietor',
      phone: '+91 ',
      email: user?.email ?? '',
      address: 'Chennai, Tamil Nadu',
    });
  };

  const printDoc = () => {
    if (!activeDoc) return;
    const html = docHtml(activeDoc, docFields, docBg);
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>${activeDoc}</title><style>@media print{body{margin:0}}body{margin:24px;background:#fff}</style></head><body>${html}<script>window.onload=function(){window.print();}</script></body></html>`);
    w.document.close();
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

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <Sparkles className="h-5 w-5 text-primary-600" /> AI Studio
          </h1>
          <p className="text-sm text-slate-500">Generate on-brand content in seconds</p>
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
      <div className="mb-5 flex justify-end">
        <div className="flex rounded-xl border border-slate-200 bg-white p-1">
          <button onClick={() => setTab('create')} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === 'create' ? 'bg-primary-50 text-primary-700' : 'text-slate-500'}`}>Create</button>
          <button onClick={() => { setTab('library'); loadLibrary(); }} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === 'library' ? 'bg-primary-50 text-primary-700' : 'text-slate-500'}`}>Library</button>
        </div>
      </div>

      {tab === 'create' ? (
        <div className="space-y-8">
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

          <div>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-400">Documents</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {DOC_TYPES.map((d) => (
                <Card key={d.key} hover className="cursor-pointer" onClick={() => openDoc(d.key)}>
                  <div className="text-2xl">{d.icon}</div>
                  <h3 className="mt-3 font-semibold text-slate-900">{d.label}</h3>
                  <p className="mt-0.5 text-xs text-slate-400">{d.desc}</p>
                </Card>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-400">Presentation generator — coming soon.</p>
          </div>
        </div>
      ) : library.length === 0 ? (
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
      )}

      {/* Generation flow */}
      <Modal isOpen={active !== null} onClose={() => setActive(null)} title={active ? `Generate ${active.label}` : ''} maxWidth="max-w-2xl">
        {active && (
          <div className="space-y-4">
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
                  <Button leftIcon={<Save className="h-4 w-4" />} onClick={saveToLibrary}>Save to Library</Button>
                </>
              ) : (
                <Button leftIcon={<Sparkles className="h-4 w-4" />} loading={generating} onClick={generate}>{isInternalStaff ? 'Generate' : `Generate (~₹${active.cost})`}</Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Document generator */}
      <Modal isOpen={activeDoc !== null} onClose={() => setActiveDoc(null)} title={activeDoc ? DOC_TYPES.find((d) => d.key === activeDoc)?.label : ''} maxWidth="max-w-3xl">
        {activeDoc && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Business name" value={docFields.business} onChange={(e) => setDocFields({ ...docFields, business: e.target.value })} />
              <Input label="Person name" value={docFields.person} onChange={(e) => setDocFields({ ...docFields, person: e.target.value })} />
              <Input label="Designation" value={docFields.designation} onChange={(e) => setDocFields({ ...docFields, designation: e.target.value })} />
              <Input label="Phone" value={docFields.phone} onChange={(e) => setDocFields({ ...docFields, phone: e.target.value })} />
              <Input label="Email" value={docFields.email} onChange={(e) => setDocFields({ ...docFields, email: e.target.value })} />
              <Input label="Address" value={docFields.address} onChange={(e) => setDocFields({ ...docFields, address: e.target.value })} />
            </div>
            <div className="flex items-center justify-between rounded-xl bg-primary-50 px-3 py-2">
              <span className="text-xs text-primary-700">AI design background — your details stay crisp on top{isInternalStaff ? ' · Free' : ''}</span>
              <div className="flex items-center gap-2">
                {docBg && <button onClick={() => setDocBg(null)} className="text-xs font-medium text-slate-500 hover:text-slate-700">Remove</button>}
                <Button size="sm" variant="outline" leftIcon={<Sparkles className="h-3.5 w-3.5" />} loading={docBgLoading} onClick={generateDocBg}>
                  {docBg ? 'Regenerate design' : 'Generate AI design'}
                </Button>
              </div>
            </div>
            {docBgNote && <p className="text-xs text-amber-700">{docBgNote}</p>}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-2 text-xs font-medium text-slate-500">Preview</div>
              <div className="overflow-x-auto rounded-lg bg-white p-4" dangerouslySetInnerHTML={{ __html: docHtml(activeDoc, docFields, docBg) }} />
            </div>
            <div className="flex justify-end">
              <Button leftIcon={<Download className="h-4 w-4" />} onClick={printDoc}>Download / Print as PDF</Button>
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
