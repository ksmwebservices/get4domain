'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChat, QUICK_REPLIES } from '@/components/chatbot/ChatProvider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export function ChatWidget() {
  const { messages, isOpen, toggleChat, sendMessage } = useChat();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (text?: string) => {
    const msg = text ?? input;
    if (!msg.trim()) return;
    sendMessage(msg);
    setInput('');
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={toggleChat}
        className={cn(
          'fixed bottom-20 right-4 md:bottom-6 md:right-6 z-[55] flex h-14 w-14 items-center justify-center rounded-full shadow-2xl transition-all duration-300',
          isOpen ? 'bg-foreground text-background rotate-90' : 'bg-primary text-primary-foreground hover:scale-110'
        )}
        aria-label="Toggle chat"
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        {!isOpen && (
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
          </span>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-36 right-4 md:bottom-24 md:right-6 z-[55] w-[calc(100vw-2rem)] max-w-sm animate-reveal">
          <div className="bg-background rounded-2xl shadow-2xl border border-border flex flex-col max-h-[60vh] md:max-h-[500px] overflow-hidden">
            {/* Header */}
            <div className="bg-foreground text-background px-4 py-3 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary">
                <Bot className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">Step N Rock Assistant</p>
                <p className="text-xs text-background/70 flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 inline-block" />
                  Online
                </p>
              </div>
              <button onClick={toggleChat} className="text-background/70 hover:text-background">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 px-4 py-3" ref={scrollRef as never}>
              <div className="space-y-3">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn('flex gap-2', msg.role === 'user' && 'flex-row-reverse')}
                  >
                    <div className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                      msg.role === 'bot' ? 'bg-accent text-primary' : 'bg-foreground text-background'
                    )}>
                      {msg.role === 'bot' ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                    </div>
                    <div className={cn('max-w-[80%] space-y-1', msg.role === 'user' && 'flex flex-col items-end')}>
                      <div className={cn(
                        'rounded-2xl px-3.5 py-2 text-sm',
                        msg.role === 'bot'
                          ? 'bg-accent text-accent-foreground rounded-tl-sm'
                          : 'bg-primary text-primary-foreground rounded-tr-sm'
                      )}>
                        {msg.text}
                      </div>
                      {msg.action && (
                        <Link
                          href={msg.action.href}
                          onClick={toggleChat}
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          {msg.action.label} <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick replies */}
              {messages.length <= 2 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {QUICK_REPLIES.slice(0, 4).map((reply) => (
                    <button
                      key={reply}
                      onClick={() => handleSend(reply)}
                      className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-accent hover:text-primary transition-colors"
                    >
                      {reply}
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Input */}
            <div className="border-t p-3 flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Type a message..."
                className="flex-1 rounded-full bg-secondary px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <Button size="icon" onClick={() => handleSend()} className="rounded-full h-10 w-10 shrink-0">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
