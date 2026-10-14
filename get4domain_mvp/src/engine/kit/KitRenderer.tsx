import EngineSiteFrame from '../components/EngineSiteFrame';
import Reveal from '../components/Reveal';
import { CartProvider, type CheckoutMode } from '../components/EngineCart';
import type { EngineMode } from '../types';
import type { KitSiteModel } from './model';
import KitNav from './KitNav';
import KitHero from './KitHero';
import KitEnquiry from './KitEnquiry';
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
  return (
    <CartProvider enabled={shop && !!subdomain} subdomain={subdomain} brandName={b.name} mode={checkoutMode}>
    <EngineSiteFrame tokens={model.theme} bottomNav={model.bottomNav}>
      <KitNav brand={b.name} logo={b.logo} links={model.nav} phone={b.phone} primaryLabel={model.primaryCta.label} />
      {model.sections.map((s, i) => {
        const el = (() => {
          switch (s.type) {
            case 'hero': return <KitHero {...s} />;
            case 'stats': return <StatsBand items={s.items} />;
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
                <KitEnquiry mode={mode}
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
      <KitFooter model={model} />
    </EngineSiteFrame>
    </CartProvider>
  );
}
