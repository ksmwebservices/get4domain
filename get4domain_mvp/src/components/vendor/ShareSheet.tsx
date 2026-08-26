'use client';

import { useState } from 'react';
import { Check, Copy, Link2, Download, MessageCircle, Send, Mail, MoreHorizontal } from 'lucide-react';
import { Modal } from './Modal';

interface ShareSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Optional real shareable URL (e.g. a campaign page /go/[slug]); defaults to a share stub. */
  url?: string;
}

const shareTargets = [
  { label: 'WhatsApp', icon: MessageCircle, color: 'bg-success/15 text-success' },
  { label: 'Telegram', icon: Send, color: 'bg-brand-500/15 text-brand-300' },
  { label: 'Email', icon: Mail, color: 'bg-gold-500/15 text-gold-300' },
  { label: 'More', icon: MoreHorizontal, color: 'bg-ink-700/60 text-ink-200' },
];

export function ShareSheet({ open, onClose, title, url }: ShareSheetProps) {
  const [copied, setCopied] = useState(false);
  const shareUrl = url || `https://get4domain.app/share/${title.toLowerCase().replace(/\s+/g, '-')}`;

  const copyLink = () => {
    navigator.clipboard?.writeText(shareUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal open={open} onClose={onClose} title="Share your content" subtitle={title} size="sm">
      <div className="space-y-5">
        <p className="text-sm text-ink-400">
          Share your content anywhere — copy the link or send it directly through any app.
          Direct posting to social platforms isn&apos;t built yet, so this lets you share on your terms.
        </p>

        <div className="grid grid-cols-4 gap-3">
          {shareTargets.map((t) => (
            <button key={t.label} onClick={onClose} className="flex flex-col items-center gap-2 group">
              <div className={`w-14 h-14 rounded-2xl ${t.color} flex items-center justify-center transition-all group-hover:scale-105 group-active:scale-95`}>
                <t.icon className="w-6 h-6" />
              </div>
              <span className="text-xs text-ink-400 group-hover:text-ink-200">{t.label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 p-3 bg-ink-900/60 border border-ink-700/50 rounded-xl">
          <Link2 className="w-4 h-4 text-ink-500 shrink-0" />
          <span className="text-xs text-ink-400 truncate flex-1">{shareUrl}</span>
          <button onClick={copyLink} className="btn-ghost-soft !py-1 !px-2 text-xs">
            {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        <button onClick={onClose} className="btn-primary w-full">
          <Download className="w-4 h-4" />
          Download to device
        </button>
      </div>
    </Modal>
  );
}

export default ShareSheet;
