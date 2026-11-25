import type { CSSProperties, ReactNode } from 'react';
import { KIT_CSS, heroArt, themeVars } from '@/lib/v3-public/site-kit/css';
import { enquiryHref, navItems, telHref, visibleSections, type NavItem } from '@/lib/v3-public/site-kit/nav';
import type { KitTheme, SectionKey } from '@/lib/v3-public/site-kit/themes';
import type { SiteView } from '@/lib/v3-public/site-kit/view';
import { PoweredBy } from '@/engine/components/PoweredBy';
import InstallButton from './InstallButton';

/**
 * The vendor site as a small web app, for every theme: a top bar on a computer, a sticky bottom bar on a phone, the theme's sections in the theme's order, an
 * "Install app" button for phones, and one small footer line. In "info" mode (Free) this file never writes a form, a chat, a mailto or tel link, or a call-to-action
 * link: the view has no e-mail or WhatsApp in it, and every place that could link checks `live` first. Pictures are plain <img> (the vendor's own or this kit's art).
 */
const Icon = ({ k }: { k: NavItem['key'] }) => {
  const p = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (k === 'home') return <svg {...p}><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10" /></svg>;
  if (k === 'services') return <svg {...p}><rect x="4" y="4" width="7" height="7" rx="1" /><rect x="13" y="4" width="7" height="7" rx="1" /><rect x="4" y="13" width="7" height="7" rx="1" /><rect x="13" y="13" width="7" height="7" rx="1" /></svg>;
  if (k === 'gallery') return <svg {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-9 9" /></svg>;
  if (k === 'reviews') return <svg {...p}><path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8z" /></svg>;
  if (k === 'find') return <svg {...p}><path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>;
  return <svg {...p}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" /></svg>;
};

function Heading({ children }: { children: ReactNode }) { return <h2>{children}</h2>; }

export default function SiteApp({ view, theme }: { view: SiteView; theme: KitTheme }) {
  const d = theme.design;
  const live = view.mode === 'live';
  const sections = visibleSections(view, d.order);
  const nav = navItems(view, sections);
  const enq = enquiryHref(view);
  const tel = live ? telHref(view.phone) : null;
  const priced = view.items.filter((i) => i.price).length >= 3;
  const art = view.banner ?? heroArt(d.imagery, theme.colors.accent, theme.cssVars['--g4d-soft'] ?? theme.colors.bg);
  const sample = view.sample ? <span className="sk-flag">Sample</span> : null;
  const mapsHref = live && view.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(view.address)}` : null;

  const section = (k: SectionKey): ReactNode => {
    switch (k) {
      case 'hero':
        return (
          <header className="sk-hero" key="hero" id="top">
            <div className="sk-in">
              <div>
                {view.category ? <p className="sk-eyebrow">{view.category}</p> : null}
                <h1>{view.name}</h1>
                {view.tagline ? <p className="sk-sub">{view.tagline}</p> : null}
                {live && (enq || tel) ? (
                  <div className="sk-acts">
                    {enq ? <a className="sk-btn" href={enq.href} {...(enq.kind === 'whatsapp' ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{view.ctaLabel}</a> : null}
                    {tel && enq?.kind !== 'tel' ? <a className="sk-btn alt" href={tel}>Call us</a> : null}
                  </div>
                ) : null}
                <div className="sk-acts"><InstallButton appName={view.name} /></div>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="sk-art" src={art} alt="" width={960} height={640} />
            </div>
          </header>
        );
      case 'services':
        return (
          <section className="sk-sec" id="services" key="services">
            <div className="sk-wrap">
              <Heading>{theme.families[0] === 'menu' ? 'Menu' : theme.families[0] === 'shop' || theme.families[0] === 'listings' ? 'What we have' : 'What we offer'}{sample}</Heading>
              <ul className="sk-list">
                {view.items.map((x, i) => (
                  <li className="sk-card" key={`${x.name}-${i}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {x.image ? <img src={x.image} alt={x.name} width={480} height={320} loading="lazy" /> : null}
                    <div className="sk-pad">
                      <h3>{x.name}</h3>
                      {x.description ? <p className="sk-muted">{x.description}</p> : null}
                    </div>
                    {x.price && !priced ? <div className="sk-pad"><span className="sk-price">{x.price}</span></div> : null}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        );
      case 'pricing':
        return (
          <section className="sk-sec" id="pricing" key="pricing">
            <div className="sk-wrap">
              <Heading>Prices</Heading>
              <table className="sk-pricing"><tbody>{view.items.filter((i) => i.price).map((i, n) => <tr key={`${i.name}-${n}`}><td>{i.name}</td><td>{i.price}</td></tr>)}</tbody></table>
            </div>
          </section>
        );
      case 'gallery':
        return (
          <section className="sk-sec" id="gallery" key="gallery">
            <div className="sk-wrap">
              <Heading>Gallery{sample}</Heading>
              <div className="sk-gal">{/* eslint-disable-next-line @next/next/no-img-element */}{view.gallery.map((g) => <img key={g.src} src={g.src} alt={g.alt} width={480} height={480} loading="lazy" />)}</div>
            </div>
          </section>
        );
      case 'reviews':
        return (
          <section className="sk-sec" id="reviews" key="reviews">
            <div className="sk-wrap">
              <Heading>Reviews{sample}</Heading>
              <ul className="sk-list">{view.reviews.map((r, i) => <li key={i}><blockquote className="sk-quote"><p>{r.quote}</p>{r.author ? <footer>{r.author}</footer> : null}</blockquote></li>)}</ul>
            </div>
          </section>
        );
      case 'faq':
        return (
          <section className="sk-sec" id="faq" key="faq">
            <div className="sk-wrap">
              <Heading>Questions{sample}</Heading>
              {view.faqs.map((f, i) => <details key={i}><summary>{f.q}</summary><p>{f.a}</p></details>)}
            </div>
          </section>
        );
      case 'map':
        return (
          <section className="sk-sec" id="find" key="find">
            <div className="sk-wrap">
              <Heading>Find us</Heading>
              <dl className="sk-find">
                {view.address ? <><dt>Address</dt><dd>{view.address}</dd></> : null}
                {view.hours.length ? <><dt>Opening hours</dt><dd>{view.hours.map((h) => <span key={h} style={{ display: 'block' }}>{h}</span>)}</dd></> : null}
                {!live && view.phone ? <><dt>Phone</dt><dd>{view.phone}</dd></> : null}
                {mapsHref ? <dd><a className="sk-btn alt" href={mapsHref} target="_blank" rel="noopener noreferrer">Open in Maps</a></dd> : null}
              </dl>
            </div>
          </section>
        );
      case 'contact': {
        // info mode: the phone is already plain text under Find us (or here when there is no address and no hours)
        if (!live) return view.phone && !sections.includes('map') ? <section className="sk-sec" id="contact" key="contact"><div className="sk-wrap"><Heading>Contact</Heading><dl className="sk-find"><dt>Phone</dt><dd>{view.phone}</dd></dl></div></section> : null;
        return (
          <section className="sk-sec" id="contact" key="contact">
            <div className="sk-wrap">
              <Heading>Contact</Heading>
              <div className="sk-acts" style={{ display: 'flex', flexWrap: 'wrap', gap: '.75rem' }}>
                {tel ? <a className="sk-btn" href={tel}>Call {view.phone}</a> : null}
                {view.whatsapp && enq?.kind === 'whatsapp' ? <a className="sk-btn alt" href={enq.href} target="_blank" rel="noopener noreferrer">WhatsApp</a> : null}
                {view.email ? <a className="sk-btn alt" href={`mailto:${view.email}`}>E-mail us</a> : null}
              </div>
            </div>
          </section>
        );
      }
      default:
        return null;
    }
  };

  const style = themeVars(theme) as unknown as CSSProperties;
  const mainSections = sections.filter((s) => s !== 'hero');
  return (
    <div className="sk" style={style} data-testid="site-app" data-mode={view.mode} data-theme={theme.id} data-hero={d.hero} data-services={d.services} data-gallery={d.gallery} data-type={d.type} data-dark={d.dark ? '1' : '0'}>
      {/* eslint-disable-next-line react/no-danger */}
      <style dangerouslySetInnerHTML={{ __html: KIT_CSS }} />
      <div className="sk-top" data-testid="top-nav">
        <div className="sk-wrap">
          <a className="sk-brand" href="#top">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {view.logo ? <img src={view.logo} alt="" width={34} height={34} /> : null}
            <span>{view.name}</span>
          </a>
          <nav className="sk-dnav" aria-label="Site">{nav.filter((n) => n.key !== 'home').map((n) => <a key={n.key} href={n.href}>{n.label}</a>)}</nav>
        </div>
      </div>
      <main>
        {section('hero')}
        {view.about ? <section className="sk-sec" id="about"><div className="sk-wrap"><h2>About us</h2><p className="sk-muted" style={{ whiteSpace: 'pre-line', maxWidth: '44rem' }}>{view.about}</p></div></section> : null}
        {mainSections.map((s) => section(s))}
      </main>
      <footer className="sk-foot"><small><PoweredBy /></small></footer>
      <nav className="sk-bnav" aria-label="App" data-testid="bottom-nav">
        {nav.map((n) => (
          <a key={n.key} href={n.href} {...(n.kind === 'enquire' && n.href.startsWith('https://') ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className={n.key === 'home' ? 'act' : undefined}><Icon k={n.key} /><span>{n.label}</span></a>
        ))}
      </nav>
    </div>
  );
}
