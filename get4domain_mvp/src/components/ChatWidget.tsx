'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Send, PhoneCall, Mail, Loader2, Check } from 'lucide-react';
import { api } from '@/lib/api';

const SUPPORT_EMAIL = 'support@get4domain.com';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  suggestedActions?: string[];
}

/** Custom event other components can dispatch to open the chat (e.g. a mobile bottom-nav "Chat" tab). */
export const OPEN_CHAT_EVENT = 'g4d:open-chat';

interface ChatWidgetProps {
  context: 'marketing' | 'dashboard';
  position?: 'left' | 'right';
  title: string;
  subtitle: string;
  greeting: string;
  quickReplies: string[];
  vendorName?: string;
  industry?: string;
  /** Hide the floating launcher below md (used when a mobile bottom-nav tab opens the chat instead). */
  hideLauncherOnMobile?: boolean;
  /** Listen for the global OPEN_CHAT_EVENT so external triggers can open the panel. */
  respondToOpenEvent?: boolean;
}

export default function ChatWidget({
  context,
  position = 'right',
  title,
  subtitle,
  greeting,
  quickReplies,
  vendorName,
  industry,
  hideLauncherOnMobile = false,
  respondToOpenEvent = false,
}: ChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  // Allow external triggers (e.g. the marketing mobile bottom-nav "Chat" tab) to open the panel.
  useEffect(() => {
    if (!respondToOpenEvent) return;
    const openChat = () => setOpen(true);
    window.addEventListener(OPEN_CHAT_EVENT, openChat);
    return () => window.removeEventListener(OPEN_CHAT_EVENT, openChat);
  }, [respondToOpenEvent]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await api.chat({
        message: text,
        conversationHistory: nextMessages.map(({ role, content }) => ({ role, content })),
        context,
        industry,
        vendorName,
      });
      const { reply, suggestedActions } = res.data ?? { reply: "Let me connect you with our team for that specific question.", suggestedActions: ['callback'] };
      setMessages((prev) => [...prev, { role: 'assistant', content: reply, suggestedActions }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: "Sorry, I'm having trouble connecting right now. Let me connect you with our team instead.",
          suggestedActions: ['callback'],
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const positionClass = position === 'left' ? 'left-6' : 'right-6';
  const panelPositionClass = position === 'left' ? 'left-6' : 'right-6';

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`fixed bottom-6 ${positionClass} z-50 ${hideLauncherOnMobile ? 'hidden md:block' : ''}`}
        aria-label="Chat with us"
      >
        <img
          src="/favicon-96x96.png"
          alt="Get4Domain Chat"
          className="w-16 h-16 rounded-full shadow-lg hover:scale-110 transition-transform cursor-pointer"
          style={{ width: '64px', height: '64px' }}
        />
      </button>

      {open && (
        <div className={`fixed bottom-24 ${panelPositionClass} z-50 flex h-[28rem] w-[22rem] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-premium animate-fade-in`}>
          <div className="flex items-center justify-between bg-primary-600 px-4 py-3.5 text-white">
            <div>
              <div className="text-sm font-bold">{title}</div>
              <div className="text-xs text-primary-100">{subtitle}</div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close chat" className="rounded-lg p-1 hover:bg-primary-500">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-4 py-4">
            <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white border border-slate-200 px-3.5 py-2.5 text-sm text-slate-700 shadow-sm">
              {greeting}
            </div>

            {messages.length === 0 && (
              <div className="flex flex-col gap-2 pt-1">
                {quickReplies.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-left text-xs font-medium text-primary-700 hover:bg-primary-100 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
                  m.role === 'user'
                    ? 'rounded-tr-sm bg-primary-600 text-white'
                    : 'rounded-tl-sm bg-white border border-slate-200 text-slate-700'
                }`}>
                  {m.content}
                  {m.role === 'assistant' && m.suggestedActions && m.suggestedActions.some((a) => ['callback', 'call', 'whatsapp'].includes(a)) && (
                    // Human escalation: we call the person back — no inbound number is shown.
                    <CallbackCTA vendorName={vendorName} context={context} />
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-white border border-slate-200 px-4 py-3 shadow-sm">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
            className="flex items-center gap-2 border-t border-slate-200 bg-white p-3"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Send message"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40 transition-colors"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

const cbInput =
  'w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 placeholder-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100';

/**
 * Human-escalation CTA. Policy: we never show an inbound number — instead the person
 * requests a callback (name + phone, prefilled for a known vendor) and Get4Domain calls
 * them back. A support email is the fallback channel.
 */
function CallbackCTA({ vendorName, context }: { vendorName?: string; context: 'marketing' | 'dashboard' }) {
  const [phase, setPhase] = useState<'idle' | 'form' | 'sending' | 'done'>('idle');
  const [name, setName] = useState(vendorName ?? '');
  const [phone, setPhone] = useState('');
  const [err, setErr] = useState('');

  async function submit() {
    if (!name.trim() || phone.replace(/\D/g, '').length < 10) {
      setErr('Please add your name and a 10-digit phone number.');
      return;
    }
    setErr('');
    setPhase('sending');
    try {
      await api.requestCallback({ name: name.trim(), phone: phone.trim(), context, business: vendorName });
      setPhase('done');
    } catch {
      setErr(`Could not send — please email ${SUPPORT_EMAIL}.`);
      setPhase('form');
    }
  }

  if (phase === 'done') {
    return (
      <div className="mt-2.5 rounded-lg bg-success-50 px-3 py-2 text-xs text-success-700">
        <Check className="mr-1 inline h-3.5 w-3.5" />Thanks! Our team will call you back shortly.
      </div>
    );
  }

  return (
    <div className="mt-2.5">
      {phase === 'idle' ? (
        <button
          onClick={() => setPhase('form')}
          className="flex items-center gap-1 rounded-lg bg-primary-50 px-2.5 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-100"
        >
          <PhoneCall className="h-3 w-3" />Request a callback
        </button>
      ) : (
        <div className="space-y-1.5">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className={cbInput} />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" inputMode="tel" className={cbInput} />
          {err && <p className="text-[11px] text-error-600">{err}</p>}
          <button
            onClick={submit}
            disabled={phase === 'sending'}
            className="flex w-full items-center justify-center gap-1 rounded-lg bg-primary-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {phase === 'sending' ? <Loader2 className="h-3 w-3 animate-spin" /> : <PhoneCall className="h-3 w-3" />}We&apos;ll call you back
          </button>
        </div>
      )}
      <a href={`mailto:${SUPPORT_EMAIL}`} className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-700">
        <Mail className="h-3 w-3" />or email {SUPPORT_EMAIL}
      </a>
    </div>
  );
}
