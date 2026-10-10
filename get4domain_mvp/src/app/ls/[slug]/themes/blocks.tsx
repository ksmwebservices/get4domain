'use client';

import { useState } from 'react';
import { Briefcase, Building2, Camera, CheckCircle2, ChevronDown, Clock, GraduationCap, Home, MapPin, Scale, Scissors, Sparkles, Stethoscope, Store, Tag, Utensils, Wrench } from 'lucide-react';
import type { Block, ServiceItem, Theme, TradeId } from './model';
import { SmartImage, hexToRgba } from './ui';

type IconType = React.ComponentType<{ size?: number; className?: string }>;
const tradeIcons: Record<TradeId, IconType> = {
  'home-services': Wrench, 'builders-interiors': Building2, 'real-estate': Home, freelancer: Briefcase, startup: Sparkles, 'photography-events': Camera,
  tutor: GraduationCap, 'salon-beauty': Scissors, 'shop-retail': Store, 'restaurant-food': Utensils, advocate: Scale, clinic: Stethoscope,
};

export interface BlockProps {
  block: Block; theme: Theme; tradeId: TradeId; categoryLabel: string; rera?: string | null; onPrimaryClick: () => void;
  cartItems?: Record<string, number>; onAddToCart?: (name: string) => void; onRemoveFromCart?: (name: string) => void;
}

export function BlockRenderer(p: BlockProps): React.ReactElement | null {
  const b = p.block;
  switch (b.type) {
    case 'hero': return <HeroView block={b} theme={p.theme} tradeId={p.tradeId} categoryLabel={p.categoryLabel} rera={p.rera} onPrimaryClick={p.onPrimaryClick} />;
    case 'offer': return <OfferView block={b} theme={p.theme} />;
    case 'services': return <ServicesView block={b} theme={p.theme} cartItems={p.cartItems} onAdd={p.onAddToCart} onRemove={p.onRemoveFromCart} />;
    case 'about': return <section className="lsa-slide-up mt-6 px-5"><h2 className="mb-2 text-lg font-bold" style={{ color: p.theme.ink }}>About</h2><p className="text-sm leading-relaxed text-gray-600">{b.text}</p></section>;
    case 'gallery': return <GalleryView block={b} theme={p.theme} />;
    case 'trust': return <TrustView block={b} theme={p.theme} />;
    case 'map': return <WhereView block={b} theme={p.theme} />;
    case 'faq': return <FaqView block={b} theme={p.theme} />;
    default: return null;
  }
}

function HeroView({ block, theme, tradeId, categoryLabel, rera, onPrimaryClick }: { block: Extract<Block, { type: 'hero' }>; theme: Theme; tradeId: TradeId; categoryLabel: string; rera?: string | null; onPrimaryClick: () => void }): React.ReactElement {
  const Icon = tradeIcons[tradeId] ?? Store;
  return (
    <section className="lsa-fade-in relative">
      <div className="relative overflow-hidden">
        {block.image ? (
          <div className="relative h-72 overflow-hidden sm:h-80">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={block.image} alt="" loading="eager" className="h-full w-full object-cover" />
            <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${theme.ink} 0%, ${hexToRgba(theme.ink, 0.6)} 40%, ${hexToRgba(theme.ink, 0.2)} 100%)` }} />
          </div>
        ) : null}
        <div className={block.image ? 'absolute bottom-0 left-0 right-0 p-5 pb-6' : 'relative p-5 pb-10 pt-12'} style={block.image ? undefined : { background: `linear-gradient(135deg, ${theme.accent}, ${theme.accentDark})` }}>
          {!block.image ? <Icon size={72} className="pointer-events-none absolute right-4 top-4 text-white opacity-15" /> : null}
          <div className="lsa-slide-up mb-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium" style={{ backgroundColor: hexToRgba(theme.accent, 0.92), color: '#fff' }}>
            <Icon size={12} />
            <span>{categoryLabel}</span>
          </div>
          <h1 className="lsa-slide-up mb-2 text-2xl font-bold leading-tight text-white" style={{ animationDelay: '0.05s' }}>{block.headline}</h1>
          <p className="lsa-slide-up text-sm leading-relaxed text-white/90" style={{ animationDelay: '0.1s' }}>{block.subline}</p>
          {rera ? <p className="mt-2 text-xs font-medium text-white/90">RERA registration: {rera}</p> : null}
        </div>
      </div>
      <div className="relative z-10 -mt-5 px-5">
        <button type="button" onClick={onPrimaryClick} className="lsa-slide-up flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-base font-semibold text-white transition-all duration-200 active:scale-[0.97] hover:shadow-lg" style={{ backgroundColor: theme.accent, boxShadow: `0 4px 14px ${hexToRgba(theme.accent, 0.35)}`, minHeight: '48px' }}>
          {block.primaryButton}
        </button>
      </div>
    </section>
  );
}

function OfferView({ block, theme }: { block: Extract<Block, { type: 'offer' }>; theme: Theme }): React.ReactElement {
  return (
    <section className="lsa-slide-up mt-4 px-5">
      <div className="flex items-start gap-3 rounded-2xl p-4" style={{ backgroundColor: theme.soft, border: `1px solid ${hexToRgba(theme.accent, 0.15)}` }}>
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: hexToRgba(theme.accent, 0.12) }}><Tag size={18} style={{ color: theme.accent } as React.CSSProperties} /></div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold" style={{ color: theme.ink }}>{block.headline}</h3>
          <p className="mt-0.5 text-sm leading-relaxed text-gray-600">{block.text}</p>
          {block.validUntil ? <p className="mt-1 text-xs text-gray-500">Valid until {block.validUntil}</p> : null}
        </div>
      </div>
    </section>
  );
}

function ServicesView({ block, theme, cartItems, onAdd, onRemove }: { block: Extract<Block, { type: 'services' }>; theme: Theme; cartItems?: Record<string, number>; onAdd?: (n: string) => void; onRemove?: (n: string) => void }): React.ReactElement {
  const cartMode = !!onAdd;
  return (
    <section className="mt-6 px-5">
      <h2 className="mb-3 text-lg font-bold" style={{ color: theme.ink }}>{block.title}</h2>
      <div className="grid grid-cols-2 gap-3">
        {block.items.map((item, i) => <ServiceCard key={`${item.name}-${i}`} item={item} theme={theme} index={i} cartMode={cartMode} qty={cartItems?.[item.name] ?? 0} onAdd={onAdd} onRemove={onRemove} />)}
      </div>
    </section>
  );
}

function ServiceCard({ item, theme, index, cartMode, qty, onAdd, onRemove }: { item: ServiceItem; theme: Theme; index: number; cartMode: boolean; qty: number; onAdd?: (n: string) => void; onRemove?: (n: string) => void }): React.ReactElement {
  return (
    <div id={`item-${index + 1}`} className="lsa-slide-up overflow-hidden rounded-2xl border border-gray-100 bg-white transition-all duration-200 hover:shadow-md" style={{ animationDelay: `${Math.min(index, 10) * 0.04}s` }}>
      <div className="relative aspect-[4/3] overflow-hidden">
        <SmartImage src={item.image} alt={item.name} fallbackLetter={item.name.charAt(0)} accentColor={theme.accent} className="h-full w-full" />
        {cartMode && qty > 0 ? <div className="lsa-scale-in absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: theme.accent }}>{qty}</div> : null}
      </div>
      <div className="p-3">
        <h3 className="text-sm font-semibold leading-snug" style={{ color: theme.ink }}>{item.name}</h3>
        {item.priceText ? <p className="mt-1 text-sm font-bold" style={{ color: theme.accentDark }}>{item.priceText}</p> : null}
        {item.description ? <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-600">{item.description}</p> : null}
        {item.buyPath ? <a href={item.buyPath} target="_blank" rel="noopener noreferrer nofollow sponsored" className="mt-2 inline-block text-xs font-semibold underline" style={{ color: theme.accentDark }}>Buy online</a> : null}
        {cartMode ? (
          <div className="mt-2 flex items-center gap-2">
            {qty > 0 ? (
              <div className="flex w-full items-center gap-2">
                <button type="button" onClick={() => onRemove?.(item.name)} className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold active:scale-90" style={{ backgroundColor: hexToRgba(theme.accent, 0.1), color: theme.accentDark }} aria-label={`One less ${item.name}`}>&minus;</button>
                <span className="flex-1 text-center text-sm font-semibold" style={{ color: theme.ink }}>{qty}</span>
                <button type="button" onClick={() => onAdd?.(item.name)} className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white active:scale-90" style={{ backgroundColor: theme.accentDark }} aria-label={`One more ${item.name}`}>+</button>
              </div>
            ) : (
              <button type="button" onClick={() => onAdd?.(item.name)} className="flex min-h-[40px] w-full items-center justify-center gap-1 rounded-lg text-xs font-semibold active:scale-95" style={{ backgroundColor: hexToRgba(theme.accent, 0.1), color: theme.accentDark }}>
                <span className="text-base leading-none">+</span> Add
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function GalleryView({ block, theme }: { block: Extract<Block, { type: 'gallery' }>; theme: Theme }): React.ReactElement {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section className="mt-6">
      <h2 className="mb-3 px-5 text-lg font-bold" style={{ color: theme.ink }}>Our work</h2>
      <div className="lsa-no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2">
        {block.images.map((img, i) => (
          <button key={i} type="button" onClick={() => setOpen(i)} aria-label={`Open picture ${i + 1}`} className="h-40 w-40 flex-shrink-0 snap-center overflow-hidden rounded-2xl transition-transform duration-200 active:scale-[0.98]">
            <SmartImage src={img.src} alt={img.alt || `Picture ${i + 1}`} accentColor={theme.accent} className="h-full w-full" />
          </button>
        ))}
      </div>
      {open !== null ? (
        <div role="dialog" aria-modal="true" aria-label="Picture" className="lsa-fade-in fixed inset-0 z-50 flex items-center justify-center p-5" style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }} onClick={() => setOpen(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={block.images[open].src} alt={block.images[open].alt || ''} className="lsa-scale-in max-h-full max-w-full rounded-2xl" />
        </div>
      ) : null}
    </section>
  );
}

function TrustView({ block, theme }: { block: Extract<Block, { type: 'trust' }>; theme: Theme }): React.ReactElement {
  return (
    <section className="mt-5 px-5">
      <div className="flex flex-col gap-2">
        {block.items.map((t, i) => (
          <div key={i} className="lsa-slide-up flex items-center gap-2.5" style={{ animationDelay: `${i * 0.06}s` }}>
            <CheckCircle2 size={18} className="flex-shrink-0" style={{ color: theme.accent } as React.CSSProperties} />
            <span className="text-sm font-medium" style={{ color: theme.ink }}>{t}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Only the areas served and the hours. The page never shows an address, a map link, a phone number or an e-mail: customers reach the business through us. */
function WhereView({ block, theme }: { block: Extract<Block, { type: 'map' }>; theme: Theme }): React.ReactElement | null {
  if (!block.area && !block.hours) return null;
  return (
    <section className="mt-6 px-5">
      <h2 className="mb-3 text-lg font-bold" style={{ color: theme.ink }}>Where we serve</h2>
      <div className="grid grid-cols-2 gap-3">
        {block.area ? (
          <div className="flex flex-col gap-2 rounded-2xl p-3.5" style={{ backgroundColor: theme.soft }}>
            <MapPin size={18} style={{ color: theme.accent } as React.CSSProperties} />
            <div><p className="text-xs font-medium text-gray-600">Areas we serve</p><p className="mt-0.5 text-sm font-semibold" style={{ color: theme.ink }}>{block.area}</p></div>
          </div>
        ) : null}
        {block.hours ? (
          <div className="flex flex-col gap-2 rounded-2xl p-3.5" style={{ backgroundColor: theme.soft }}>
            <Clock size={18} style={{ color: theme.accent } as React.CSSProperties} />
            <div><p className="text-xs font-medium text-gray-600">Hours</p><p className="mt-0.5 text-sm font-semibold" style={{ color: theme.ink }}>{block.hours}</p></div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function FaqView({ block, theme }: { block: Extract<Block, { type: 'faq' }>; theme: Theme }): React.ReactElement {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="mt-6 px-5">
      <h2 className="mb-3 text-lg font-bold" style={{ color: theme.ink }}>Questions &amp; answers</h2>
      <div className="flex flex-col gap-2">
        {block.items.map((item, i) => {
          const isOpen = open === i;
          return (
            <div key={i} className="overflow-hidden rounded-xl border border-gray-100 bg-white">
              <button type="button" onClick={() => setOpen(isOpen ? null : i)} className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left" aria-expanded={isOpen}>
                <span className="text-sm font-semibold" style={{ color: theme.ink }}>{item.q}</span>
                <ChevronDown size={18} className={`flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} style={{ color: theme.accent } as React.CSSProperties} />
              </button>
              {isOpen ? <p className="px-4 pb-3.5 text-sm leading-relaxed text-gray-600">{item.a}</p> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
