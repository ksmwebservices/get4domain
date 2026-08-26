'use client';

import { useState } from 'react';
import { Bot, Film, Image as ImageIcon, PenTool, Sparkles, Wand2, Play, type LucideIcon } from 'lucide-react';

interface Tool { id: string; name: string; icon: LucideIcon; desc: string; }

const TOOLS: Tool[] = [
  { id: 'reels', name: 'Reel Maker', icon: Film, desc: 'Create promotional reels in seconds' },
  { id: 'poster', name: 'Poster Designer', icon: ImageIcon, desc: 'Design posters & flyers with AI' },
  { id: 'content', name: 'Content Writer', icon: PenTool, desc: 'Generate captions, descriptions, ads' },
];

export default function AIStudio() {
  const [active, setActive] = useState('reels');

  return (
    <section className="relative py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* left: visual */}
          <div className="relative order-2 flex justify-center lg:order-1">
            <div className="animate-float-slow">
              <div className="relative rounded-[2rem] bg-slate-950 p-2.5 shadow-device-phone" style={{ width: 'clamp(240px, 28vw, 320px)' }}>
                <div className="relative overflow-hidden rounded-[1.6rem] bg-slate-50" style={{ aspectRatio: '9 / 19' }}>
                  <div className="flex h-full flex-col">
                    <div className="bg-gradient-to-br from-warning-400 to-secondary-500 px-4 py-3 text-white">
                      <div className="mb-1 flex items-center gap-2"><Bot className="h-5 w-5" /><span className="text-sm font-semibold">AI Studio</span></div>
                      <div className="text-[10px] text-white/80">Create marketing content with AI</div>
                    </div>
                    <div className="flex-1 overflow-hidden p-3">
                      {active === 'reels' && <ReelsMock />}
                      {active === 'poster' && <PosterMock />}
                      {active === 'content' && <ContentMock />}
                    </div>
                  </div>
                </div>
                <div className="absolute left-1/2 top-4 z-10 h-3.5 w-14 -translate-x-1/2 rounded-full bg-slate-950" />
              </div>
            </div>
            <div className="absolute -bottom-6 left-1/2 h-8 w-2/3 -translate-x-1/2 rounded-full bg-warning-500/15 blur-3xl" />
          </div>

          {/* right: text + tool tabs */}
          <div className="order-1 lg:order-2">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/5 bg-slate-800/60 px-3.5 py-1.5 text-xs font-medium text-warning-300 backdrop-blur-xl">
              <Bot className="h-3.5 w-3.5" /> AI Studio
            </div>
            <h2 className="mb-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Marketing content <span className="text-gradient-hero">powered by AI</span>
            </h2>
            <p className="mb-6 leading-relaxed text-slate-400">
              Create promotional reels, design posters, and generate marketing copy — without a designer or agency. Describe what you want and let AI do the rest. AI usage is pay-per-use from your wallet.
            </p>

            <div className="mb-2 space-y-2.5">
              {TOOLS.map((t) => {
                const Icon = t.icon;
                const isActive = t.id === active;
                return (
                  <button key={t.id} onClick={() => setActive(t.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-all duration-300 ${isActive ? 'border-warning-400/30 bg-warning-500/10 shadow-glow-amber' : 'border-white/5 bg-slate-800/40 hover:bg-slate-800/70'}`}>
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-transform ${isActive ? 'scale-110 bg-gradient-to-br from-warning-400 to-secondary-500' : 'bg-slate-700'}`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className={`text-sm font-semibold ${isActive ? 'text-warning-200' : 'text-slate-200'}`}>{t.name}</div>
                      <div className="text-xs text-slate-400">{t.desc}</div>
                    </div>
                    {isActive && <Sparkles className="h-4 w-4 animate-pulse text-warning-300" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PromptBar({ placeholder, chips }: { placeholder: string; chips: string[] }) {
  return (
    <>
      <div className="flex items-center gap-1.5">
        <div className="flex-1 rounded-full bg-white px-3 py-1.5 text-[10px] text-slate-400">{placeholder}</div>
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-warning-500"><Wand2 className="h-3.5 w-3.5 text-white" /></div>
      </div>
      <div className="flex gap-1.5">
        {chips.map((t) => (<div key={t} className="rounded-full bg-white px-2 py-1 text-[8px] text-slate-500">{t}</div>))}
      </div>
    </>
  );
}

function ReelsMock() {
  return (
    <div className="animate-fade-in space-y-2">
      <div className="relative flex h-32 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-warning-400 to-secondary-500">
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-white/30 backdrop-blur"><Play className="ml-0.5 h-5 w-5 fill-white text-white" /></div>
        <div className="absolute bottom-2 left-2 right-2">
          <div className="text-[10px] font-bold text-white">Monsoon Health Tips</div>
          <div className="text-[8px] text-white/80">00:30 · AI generated</div>
        </div>
      </div>
      <PromptBar placeholder="Describe your reel..." chips={['Health tips', 'Offer promo', 'Testimonial']} />
    </div>
  );
}

function PosterMock() {
  return (
    <div className="animate-fade-in space-y-2">
      <div className="relative flex h-32 flex-col justify-between overflow-hidden rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 p-3">
        <div className="text-[10px] font-bold text-white">FLAT 40% OFF</div>
        <div>
          <div className="text-[8px] text-white/80">Health Checkup Package</div>
          <div className="text-[14px] font-bold text-white">₹999 <span className="text-[8px] line-through opacity-60">₹1,699</span></div>
        </div>
        <div className="text-[7px] text-white/70">Valid till Aug 31 · clinic.get4domain.com</div>
      </div>
      <PromptBar placeholder="Describe your poster..." chips={['Sale', 'Festival', 'New service']} />
    </div>
  );
}

function ContentMock() {
  return (
    <div className="animate-fade-in space-y-2">
      <div className="rounded-lg bg-white p-2.5 shadow-sm">
        <div className="mb-1 text-[9px] font-semibold text-slate-700">Generated caption</div>
        <div className="text-[9px] leading-relaxed text-slate-500">Stay healthy this monsoon! Get a complete health checkup at 40% OFF. Book now at clinic.get4domain.com #HealthFirst #MonsoonCare</div>
      </div>
      <div className="rounded-lg bg-white p-2.5 shadow-sm">
        <div className="mb-1 text-[9px] font-semibold text-slate-700">Ad copy</div>
        <div className="text-[9px] leading-relaxed text-slate-500">Don&apos;t let monsoon bugs catch you off guard. Full body checkup just ₹999. Limited slots. Book today!</div>
      </div>
      <PromptBar placeholder="What do you need?" chips={['Caption', 'Ad copy', 'Hashtags']} />
    </div>
  );
}
