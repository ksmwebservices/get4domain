import EngineSiteFrame from '../components/EngineSiteFrame';
import Reveal from '../components/Reveal';
import { CartProvider, type CheckoutMode } from '../components/EngineCart';
import type { EngineMode } from '../types';
import type { KitSiteModel } from './model';
import KitNav from './KitNav';
import KitHero from './KitHero';
import KitEnquiry from './KitEnquiry';
import { AnnounceBar, BeforeAfterStatic, DesignFooter, Hours, MenuSection, MobileActionBar, Packages, Pricing, TrustStrip } from './design-sections';
import { BeforeAfterSlider, Catalog, MenuTabs } from './design-client';
import {
  StatsBand, Showcase, FeatureIndex, IconGrid, Rows, Steps, Gallery, People, Testimonials, Faq, CtaBand, About, ContactDetails,
} from './sections';

/** Footer shared by kit sites. */
function KitFooter({ model }: { model: KitSiteModel }) {
  const b = model.brand;
  return (
    <footer className="border-t border-[var(--eng-border)] bg-[var(--eng-bg)] px-5 py-14">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 md:grid-cols-[2fr_1fr_1fr]">
          <div>
            <div className="font-[family-name:var(--eng-fontDisplay)] text-xl">{b.name}</div>
            <p className="mt-3 max-w-sm text-sm text-[var(--eng-muted)]">{b.tagline}</p>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-widest text-[var(--eng-muted)]">Contact</div>
            <ul className="mt-3 space-y-2 text-sm">
              {b.phone && <li><a href={`tel:${b.phone}`} className="hover:text-[var(--eng-accent)]">{b.phone}</a></li>}
              {b.email && <li><a href={`mailto:${b.email}`} className="hover:text-[var(--eng-accent)]">{b.email}</a></li>}
              {b.address && <li className="text-[var(--eng-muted)]">{b.address}{b.googleMaps && <> · <a href={b.googleMaps} target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--eng-accent)]">Map</a></>}</li>}
              {([['Facebook', b.facebook], ['Instagram', b.instagram], ['LinkedIn', b.linkedin], ['YouTube', b.youtube]] as [string, string | undefined][]).filter(([, u]) => !!u).map(([n, u]) => <li key={n}><a href={u} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--eng-accent)]">{n}</a></li>)}
            </ul>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-widest text-[var(--eng-muted)]">Get in touch</div>
            <a href="#enquiry" className="mt-3 inline-block bg-[var(--eng-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--eng-accent-fg)]" style={{ borderRadius: 'var(--eng-radius)' }}>{model.primaryCta.label}</a>
            {b.businessHours && <p className="mt-3 text-xs text-[var(--eng-muted)]">{b.businessHours}</p>}
          </div>
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-2 border-t border-[var(--eng-border)] pt-6 text-xs text-[var(--eng-muted)] sm:flex-row">
          <p>© {new Date().getFullYear()} {b.name}. All rights reserved.</p>
          <p>Powered by Get4Domain</p>
        </div>
      </div>
    </footer>
  );
}

/**
 * Renders a data-driven KitSiteModel into a full bespoke site. The industry's builder
 * decides theme + section composition + content; this maps sections to kit components.
 * Different industries pass different themes, hero/showcase variants, section orders
 * and copy — so the output reads bespoke, not templated.
 */
export default function KitRenderer({ model, mode, shop = false, checkoutMode = 'ONLINE' }: { model: KitSiteModel; mode: EngineMode; shop?: boolean; checkoutMode?: CheckoutMode }) {
  const b = model.brand;
  const subdomain = mode.kind === 'live' ? mode.subdomain : '';
  const st = model.style;
  const announce = model.sections.find((x) => x.type === 'announce');
  // the mobile action bar: "tabs" keeps the original bottom navigation; the other two are a call-to-action bar
  const barVariant = st?.actionBar ?? 'tabs';
  return (
    <CartProvider enabled={shop && !!subdomain} subdomain={subdomain} brandName={b.name} mode={checkoutMode}>
    <EngineSiteFrame tokens={model.theme} bottomNav={barVariant === 'tabs' ? model.bottomNav : []}>
      <div className={st ? `eng-btn-${st.button}` : undefined}>
      {announce && announce.type === 'announce' && <AnnounceBar variant={announce.variant} text={announce.text} href={announce.href} />}
      <KitNav brand={b.name} logo={b.logo} links={model.nav} phone={b.phone} primaryLabel={model.primaryCta.label} variant={st?.nav} offset={announce ? 36 : 0} />
      {model.sections.map((s, i) => {
        const el = (() => {
          switch (s.type) {
            case 'hero': return <KitHero {...s} />;
            case 'announce': return null;
            case 'trust': return <TrustStrip variant={s.variant} items={s.items} />;
            case 'catalog': return <Catalog {...s} />;
            case 'packages': return <Packages {...s} />;
            case 'menu': return s.variant === 'tabs' ? <MenuTabs {...s} /> : <MenuSection {...s} variant={s.variant} />;
            case 'pricing': return <Pricing {...s} />;
            case 'beforeAfter': return s.variant === 'slider' ? <BeforeAfterSlider {...s} /> : <BeforeAfterStatic {...s} variant={s.variant} />;
            case 'hours': return <Hours {...s} />;
            case 'stats': return <StatsBand items={s.items} variant={s.variant} />;
            case 'showcase': return <Showcase {...s} />;
            case 'featureIndex': return <FeatureIndex {...s} />;
            case 'iconGrid': return <IconGrid {...s} />;
            case 'rows': return <Rows {...s} />;
            case 'steps': return <Steps {...s} />;
            case 'gallery': return <Gallery {...s} />;
            case 'about': return <About {...s} />;
            case 'contact': return <ContactDetails id={s.id} variant={s.variant} eyebrow={s.eyebrow} title={s.title} sub={s.sub} brand={b} />;
            case 'people': return <People {...s} />;
            case 'testimonials': return <Testimonials {...s} />;
            case 'faq': return <Faq {...s} />;
            case 'cta': return <CtaBand {...s} />;
            case 'enquiry':
              return (
                <KitEnquiry mode={mode} variant={s.variant}
                  brand={{ name: b.name, phone: b.phone, whatsapp: b.whatsapp }}
                  choices={model.choices} choiceLabel={model.choiceLabel}
                  eyebrow={s.eyebrow} title={s.title} sub={s.sub} points={s.points} tabs={s.tabs} />
              );
            default: return null;
          }
        })();
        if (!el) return null;
        // data-layout names the layout in use (also what the layout tests look for)
        const layout = (s as { variant?: string }).variant ? `${s.type}-${(s as { variant?: string }).variant}` : s.type;
        // The hero stays instant (above the fold); every other section reveals on scroll.
        return s.type === 'hero' ? <div key={i} data-layout={layout}>{el}</div> : <Reveal key={i}><div data-layout={layout}>{el}</div></Reveal>;
      })}
      {st && st.footer !== 'columns' ? <DesignFooter variant={st.footer} brand={b} cta={model.primaryCta.label} /> : <KitFooter model={model} />}
      {(barVariant === 'cta' || barVariant === 'split') && <MobileActionBar variant={barVariant} label={model.primaryCta.label} phone={b.phone} whatsapp={b.whatsapp} />}
      </div>
    </EngineSiteFrame>
    </CartProvider>
  );
}
