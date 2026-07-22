'use client';

import { useState, useRef, useEffect } from 'react';
import { BUSINESS } from '@/lib/constants';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const QUICK_REPLIES = ['View Packages', 'Book a Trip', 'Get Pricing', 'WhatsApp Us'];

const WELCOME: ChatMessage = {
  role: 'assistant',
  content:
    "Vanakkam! I'm the Allwin Tours Assistant. Ask me about packages, pricing, or booking a trip.",
};

export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    if (/whatsapp/i.test(text)) {
      setShowWhatsApp(true);
    }

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.error || 'Something went wrong. Please try WhatsApp instead.',
          },
        ]);
        setShowWhatsApp(true);
        return;
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Connection issue. Please try WhatsApp instead.' },
      ]);
      setShowWhatsApp(true);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickReply = (label: string) => {
    if (label === 'WhatsApp Us') {
      setShowWhatsApp(true);
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: label },
        { role: 'assistant', content: 'Sure! You can chat with us directly on WhatsApp:' },
      ]);
      return;
    }
    sendMessage(label);
  };

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Open chat assistant"
        className="fixed z-40 right-6 bottom-20 md:bottom-6 w-14 h-14 rounded-full bg-[#1a3a5c] hover:bg-[#142d47] flex items-center justify-center shadow-lg shadow-black/30 transition-colors overflow-hidden"
      >
        <img src="/favicon.png" alt="Allwin Tours Assistant" className="w-9 h-9 object-contain" />
      </button>

      {open && (
        <div className="fixed z-50 right-4 bottom-36 md:bottom-24 w-[calc(100vw-2rem)] max-w-sm bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden max-h-[70vh]">
          <div className="flex items-center gap-3 bg-[#1a3a5c] text-white p-4">
            <img src="/favicon.png" alt="Allwin logo" className="w-8 h-8 rounded-full bg-white object-contain" />
            <div>
              <p className="font-semibold text-sm">Allwin Tours Assistant</p>
              <p className="text-xs text-white/70">Powered by Claude AI</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="ml-auto text-white/80 hover:text-white text-xl"
              aria-label="Close chat"
            >
              ✕
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  m.role === 'user'
                    ? 'ml-auto bg-accent text-slate-900'
                    : 'bg-white text-[#1a3a5c] border border-slate-200'
                }`}
              >
                {m.content}
              </div>
            ))}

            {loading && (
              <div className="bg-white text-[#1a3a5c] border border-slate-200 rounded-lg px-3 py-2 text-sm w-fit">
                Typing...
              </div>
            )}

            {showWhatsApp && (
              <div className="bg-white border border-slate-200 rounded-lg p-3 text-sm">
                <p className="text-[#1a3a5c] mb-2">Chat with us directly on WhatsApp:</p>
                <a
                  href={`https://wa.me/${BUSINESS.whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold px-4 py-2 rounded-lg transition-colors"
                >
                  Open WhatsApp →
                </a>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 px-4 py-2 border-t border-slate-200 bg-white">
            {QUICK_REPLIES.map((label) => (
              <button
                key={label}
                onClick={() => handleQuickReply(label)}
                className="text-xs border border-[#1a3a5c] text-[#1a3a5c] rounded-full px-3 py-1 hover:bg-[#1a3a5c] hover:text-white transition-colors"
              >
                {label}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input);
            }}
            className="flex items-center gap-2 p-3 border-t border-slate-200 bg-white"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 text-sm bg-slate-100 rounded-full px-4 py-2 text-[#1a3a5c] placeholder:text-slate-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-accent hover:bg-accent-hover text-slate-900 font-semibold w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-50"
              aria-label="Send message"
            >
              ➤
            </button>
          </form>
        </div>
      )}
    </>
  );
}
