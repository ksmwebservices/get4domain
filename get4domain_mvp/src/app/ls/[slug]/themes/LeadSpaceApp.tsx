'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ReportBox } from '../PageClient';
import { track } from '../leadspace-client';
import AppLeadForm, { hasDraft } from './AppLeadForm';
import { BlockRenderer } from './blocks';
import type { Block, PageModel } from './model';
import { DesktopTopBar, MobileNavBar, getTabs, type TabId } from './nav';
import { SmartImage, hexToRgba } from './ui';
import './leadspace-app.css';

type ServicesBlock = Extract<Block, { type: 'services' }>;

/**
 * The vendor's page as a small app: Home, Services, About and the one action, with a bottom bar on a phone and a top bar on a computer.
 * It takes the page model and nothing else. It never shows a phone number, an e-mail, an address or a map link: customers reach the business through the verified form.
 */
export default function LeadSpaceApp({ model, reportOpen }: { model: PageModel; reportOpen?: boolean }): React.ReactElement {
  const t = model.theme;
  const [tab, setTab] = useState<TabId>('home');
  const [cart, setCart] = useState<Record<string, number>>({});
  const tabs = useMemo(() => getTabs(model.templateId, model.goal), [model.templateId, model.goal]);

  const servicesBlock = model.blocks.find((b): b is ServicesBlock => b.type === 'services');
  const services = servicesBlock?.items ?? [];
  const cartMode = model.goal === 'CART_ORDER';
  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);

  const add = useCallback((name: string) => setCart((c) => ({ ...c, [name]: Math.min(99, (c[name] ?? 0) + 1) })), []);
  const remove = useCallback((name: string) => setCart((c) => {
    const cur = c[name] ?? 0;
    if (cur <= 1) { const n = { ...c }; delete n[name]; return n; }
    return { ...c, [name]: cur - 1 };
  }), []);

  // A customer who left to read the WhatsApp code comes back to their unfinished request, not to the top of the page.
  useEffect(() => { if (hasDraft(model.slug)) setTab('enquire'); }, [model.slug]);

  const go = (next: TabId): void => { setTab(next); if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const primary = (): void => { track(model.slug, 'cta'); go('enquire'); };

  const homeBlocks = model.blocks.filter((b) => b.type === 'hero' || b.type === 'offer' || b.type === 'trust');
  const serviceBlocks = model.blocks.filter((b) => b.type === 'services');
  const aboutBlocks = model.blocks.filter((b) => b.type === 'about' || b.type === 'gallery' || b.type === 'map' || b.type === 'faq');
  const where = model.blocks.find((b) => b.type === 'map');
  const common = { theme: t, tradeId: model.templateId, categoryLabel: model.business.categoryLabel, rera: model.rera, onPrimaryClick: primary };

  return (
    <div style={{ background: '#f3f4f6', color: t.ink }} className="min-h-screen">
      <div className="relative mx-auto min-h-screen bg-white lg:max-w-3xl xl:max-w-4xl" style={{ boxShadow: '0 0 40px rgba(0, 0, 0, 0.05)' }}>
        <DesktopTopBar tabs={tabs} activeTab={tab} onTabChange={go} theme={t} businessName={model.business.name} cartCount={cartCount} />

        <header className="flex items-center justify-between px-5 py-3 lg:hidden">
          <p className="text-base font-bold" style={{ color: t.ink }}>{model.business.name}</p>
          <p className="text-xs text-gray-600">{model.business.city}</p>
        </header>

        <main className="pb-24 lg:pb-8">
          {tab === 'home' ? (
            <div className="lsa-tab">
              {homeBlocks.map((b, i) => <BlockRenderer key={i} block={b} {...common} />)}
              {services.length > 0 ? (
                <div className="mt-6 px-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-lg font-bold" style={{ color: t.ink }}>{servicesBlock?.title ?? 'Services'}</h2>
                    <button type="button" onClick={() => go('services')} className="min-h-[40px] text-sm font-semibold" style={{ color: t.accentDark }}>View all</button>
                  </div>
                  <div className="lsa-no-scrollbar -mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-2">
                    {services.slice(0, 6).map((item, i) => (
                      <button key={`${item.name}-${i}`} type="button" onClick={() => go('services')} className="lsa-slide-up w-40 flex-shrink-0 snap-start overflow-hidden rounded-2xl border border-gray-100 bg-white text-left transition-all duration-200 hover:shadow-md" style={{ animationDelay: `${i * 0.05}s` }}>
                        <SmartImage src={item.image} alt={item.name} fallbackLetter={item.name.charAt(0)} accentColor={t.accent} className="aspect-[4/3] w-full" />
                        <div className="p-2.5">
                          <h3 className="text-xs font-semibold leading-snug" style={{ color: t.ink }}>{item.name}</h3>
                          {item.priceText ? <p className="mt-0.5 text-sm font-bold" style={{ color: t.accentDark }}>{item.priceText}</p> : null}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {where ? <BlockRenderer block={where} {...common} /> : null}
              <Footer slug={model.slug} reportOpen={reportOpen} />
            </div>
          ) : null}

          {tab === 'services' ? (
            <div className="lsa-tab pt-2 lg:pt-4">
              {serviceBlocks.map((b, i) => <BlockRenderer key={i} block={b} {...common} cartItems={cartMode ? cart : undefined} onAddToCart={cartMode ? add : undefined} onRemoveFromCart={cartMode ? remove : undefined} />)}
              {cartMode && cartCount > 0 ? (
                <div className="sticky bottom-20 z-20 mt-6 px-5 lg:bottom-4">
                  <button type="button" onClick={primary} className="lsa-slide-up flex w-full items-center justify-between rounded-2xl px-5 py-3.5 text-base font-semibold text-white transition-all active:scale-[0.97]" style={{ backgroundColor: t.accent, boxShadow: `0 4px 20px ${hexToRgba(t.accent, 0.4)}` }}>
                    <span>{cartCount} {cartCount === 1 ? 'item' : 'items'} selected</span>
                    <span>Review order &rarr;</span>
                  </button>
                </div>
              ) : null}
              <Footer slug={model.slug} reportOpen={reportOpen} />
            </div>
          ) : null}

          {tab === 'about' ? (
            <div className="lsa-tab pt-2 lg:pt-4">
              {aboutBlocks.map((b, i) => <BlockRenderer key={i} block={b} {...common} />)}
              {model.disclaimer ? <Disclaimer text={model.disclaimer} /> : null}
              <Footer slug={model.slug} reportOpen={reportOpen} />
            </div>
          ) : null}

          {tab === 'enquire' ? (
            <div className="lsa-tab">
              <div className="px-5 pb-2 pt-5">
                <h2 className="text-xl font-bold" style={{ color: t.ink }}>{model.primaryButton}</h2>
                <p className="mt-1 text-sm text-gray-600">Fill in your details. We confirm your number on WhatsApp and pass your request to {model.business.name}.</p>
                {model.rera ? <p className="mt-2 text-xs font-medium text-gray-700">RERA registration: {model.rera}</p> : null}
              </div>
              {model.disclaimer ? <Disclaimer text={model.disclaimer} /> : null}
              <AppLeadForm
                slug={model.slug} theme={t} businessName={model.business.name} primaryButton={model.form.submitLabel || model.primaryButton} consentText={model.form.consentText}
                fields={model.form.fields} services={services} cart={cart} setCart={setCart} onCartRemove={remove}
              />
              <Footer slug={model.slug} reportOpen={reportOpen} />
            </div>
          ) : null}
        </main>

        <MobileNavBar tabs={tabs} activeTab={tab} onTabChange={go} theme={t} cartCount={cartCount} />
      </div>
    </div>
  );
}

function Disclaimer({ text }: { text: string }): React.ReactElement {
  return <p className="mx-5 mt-4 rounded-lg border border-gray-300 bg-white p-3 text-xs leading-relaxed text-gray-700">{text}</p>;
}

function Footer({ slug, reportOpen }: { slug: string; reportOpen?: boolean }): React.ReactElement {
  return (
    <footer className="mt-10 space-y-3 px-5 pb-6 text-center text-xs text-gray-600">
      <ReportBox slug={slug} initiallyOpen={reportOpen} />
      <p><a href="/privacy-policy" className="underline">Privacy notice</a> &middot; <a href="mailto:privacy@get4domain.com?subject=Please%20delete%20my%20data" className="underline">Delete my data</a></p>
      <p>Page by <a href="https://get4domain.com" className="underline" rel="noopener">Get4Domain LeadSpace</a></p>
    </footer>
  );
}
