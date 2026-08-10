'use client';

import { useCallback, useEffect, useState } from 'react';
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

interface SavedItem {
  id: string;
  type: string;
  typeLabel: string;
  content: string;
  createdAt: string;
}

export default function AiStudioPage() {
  const { user } = useAuth();
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

  const storageKey = `g4d_ai_library_${user?.id ?? 'anon'}`;

  const refreshBalance = useCallback(() => {
    api.getWalletBalance().then((res) => setBalance(res.data?.balance ?? 0)).catch(() => setBalance(null));
  }, []);
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

  const openType = (ct: ContentType) => {
    setActive(ct); setPurpose(''); setDetails(''); setTone(TONES[0]); setResult('');
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
      });
      setResult(res.data?.caption ?? res.data?.content ?? res.data?.text ?? JSON.stringify(res.data));
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
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700">
            <Wallet className="h-4 w-4 text-primary-600" />{balance !== null ? `₹${(balance / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—'}
          </span>
          <Link href="/dashboard/wallet" className="rounded-xl bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700">+ Top Up</Link>
        </div>
      </div>
      <div className="mb-5 flex justify-end">
        <div className="flex rounded-xl border border-slate-200 bg-white p-1">
          <button onClick={() => setTab('create')} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === 'create' ? 'bg-primary-50 text-primary-700' : 'text-slate-500'}`}>Create</button>
          <button onClick={() => { setTab('library'); loadLibrary(); }} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === 'library' ? 'bg-primary-50 text-primary-700' : 'text-slate-500'}`}>Library</button>
        </div>
      </div>

      {tab === 'create' ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {CONTENT_TYPES.map((ct) => {
            const Ic = ct.icon;
            return (
              <Card key={ct.key} hover className="cursor-pointer" onClick={() => openType(ct)}>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><Ic className="h-5 w-5" /></div>
                <h3 className="mt-3 font-semibold text-slate-900">{ct.label}</h3>
                <p className="mt-0.5 text-xs text-slate-400">~₹{ct.cost} / generation</p>
              </Card>
            );
          })}
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

            <div className="flex items-center justify-between rounded-xl bg-primary-50 px-4 py-2.5">
              <span className="text-sm text-primary-700">Estimated cost</span>
              <span className="text-sm font-bold text-primary-700">~₹{active.cost}</span>
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
                <Button leftIcon={<Sparkles className="h-4 w-4" />} loading={generating} onClick={generate}>Generate (~₹{active.cost})</Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
