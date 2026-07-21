'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Send, Phone, MessageCircle as WhatsAppIcon } from 'lucide-react';
import { api } from '@/lib/api';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  suggestedActions?: string[];
}

interface ChatWidgetProps {
  context: 'marketing' | 'dashboard';
  position?: 'left' | 'right';
  title: string;
  subtitle: string;
  greeting: string;
  quickReplies: string[];
  vendorName?: string;
  industry?: string;
}

function isOfficeHours(): boolean {
  const now = new Date();
  const istOffset = 5.5 * 60; // IST is UTC+5:30
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const ist = new Date(utc + istOffset * 60000);
  const hours = ist.getHours();
  const day = ist.getDay(); // 0=Sun, 6=Sat
  return day >= 1 && day <= 6 && hours >= 9 && hours < 20;
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
}: ChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

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
      const { reply, suggestedActions } = res.data ?? { reply: "Let me connect you with our team for that specific question.", suggestedActions: ['call', 'whatsapp'] };
      setMessages((prev) => [...prev, { role: 'assistant', content: reply, suggestedActions }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: "Sorry, I'm having trouble connecting right now. Let me connect you with our team instead.",
          suggestedActions: ['call', 'whatsapp'],
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
        aria-label={open ? 'Close chat' : 'Open chat'}
        className={`fixed bottom-6 ${positionClass} z-50 flex h-32 w-32 items-center justify-center rounded-full bg-primary-600 shadow-lg hover:bg-primary-700 transition-all hover:scale-110`}
      >
        {open ? <X className="h-10 w-10 text-white" /> : <img src="/favicon.png" alt="G4D" className="w-24 h-24" />}
      </button>

      {open && (
        <div className={`fixed bottom-40 ${panelPositionClass} z-50 flex h-[28rem] w-[22rem] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-premium animate-fade-in`}>
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
                  {m.role === 'assistant' && m.suggestedActions && m.suggestedActions.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {m.suggestedActions.includes('call') && isOfficeHours() && (
                        <a href="tel:+917550047567" className="flex items-center gap-1 rounded-lg bg-primary-50 px-2.5 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-100">
                          <Phone className="h-3 w-3" />Call Us
                        </a>
                      )}
                      {m.suggestedActions.includes('call') && !isOfficeHours() && (
                        <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs text-slate-500">
                          Outside office hours — we'll respond by 9am tomorrow
                        </span>
                      )}
                      {m.suggestedActions.includes('whatsapp') && (
                        <a href="https://wa.me/917550047567" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded-lg bg-success-50 px-2.5 py-1.5 text-xs font-semibold text-success-700 hover:bg-success-100">
                          <WhatsAppIcon className="h-3 w-3" />WhatsApp
                        </a>
                      )}
                    </div>
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
