/**
 * Faithful raw-theme renderer. An uploaded static theme (Bolt/designer HTML + CSS + JS)
 * is rendered in an ISOLATED iframe as its OWN full document — so the design is
 * pixel-identical to the source, the theme's own CSS/JS run natively, and nothing
 * collides with the Get4Domain app shell. A small injected bridge wires the theme's
 * forms + booking buttons to the existing engine (real CRM lead / order) and makes
 * intra-theme links navigate the top window — no redesign, no Next.js in the theme.
 */

const esc = (s: string | null | undefined): string =>
  (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface ThemeBundle {
  /** Per page: slug (home = first), title, and the page's <body> inner HTML. */
  pages: { slug: string; title: string; html: string }[];
  css?: string | null;
  js?: string | null;
  /** Font stylesheet hrefs to preserve (e.g. Google Fonts). */
  fonts?: string[];
}

interface Cms {
  businessName?: string | null; tagline?: string | null; about?: string | null;
  logo?: string | null; phone?: string | null; whatsapp?: string | null;
  email?: string | null; address?: string | null; googleMaps?: string | null;
}
export interface FrameSite {
  vendor: { businessName: string; subdomain: string | null };
  cms: Cms | null;
}

/** Fill {{tokens}} with vendor content (used only where a theme opts in with tokens). */
function injectTokens(html: string, site: FrameSite): string {
  const cms = site.cms ?? {};
  const wa = (cms.whatsapp ?? '').replace(/\D/g, '');
  const map: Record<string, string> = {
    businessName: esc(cms.businessName || site.vendor.businessName),
    tagline: esc(cms.tagline), about: esc(cms.about), logo: esc(cms.logo),
    phone: esc(cms.phone), email: esc(cms.email), address: esc(cms.address),
    whatsapp: esc(cms.whatsapp), whatsappLink: wa ? `https://wa.me/${wa}` : '',
    mapsLink: esc(cms.googleMaps), year: String(new Date().getFullYear()),
  };
  return html.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (full, k: string) =>
    Object.prototype.hasOwnProperty.call(map, k) ? map[k] : full);
}

/** Rewrite intra-theme page links (about.html / /about) to our /site/<sub>/<slug> routes. */
function rewriteLinks(html: string, base: string, slugs: Set<string>): string {
  return html.replace(/href\s*=\s*"([^"]+)"/g, (full, href: string) => {
    if (/^(https?:|mailto:|tel:|#|data:|\/\/)/i.test(href)) return full;
    const clean = href.replace(/^\.?\//, '').replace(/\.html?$/i, '').replace(/\/$/, '');
    const slug = clean === '' || clean === 'index' || clean === 'home' ? 'home' : clean;
    if (slug === 'home' || slugs.has(slug)) return `href="${base}/${slug}"`;
    return full;
  });
}

/** The in-iframe bridge: wire forms/booking to the engine, links to the top window. */
function bridge(apiBase: string, subdomain: string, base: string): string {
  return `
<script>(function(){
  var API=${JSON.stringify(apiBase)}, SUB=${JSON.stringify(subdomain)}, BASE=${JSON.stringify(base)};
  function val(f,n){var e=f.querySelector('[name="'+n+'"]');return e?String(e.value||'').trim():'';}
  // Wire every form to the vendor's real CRM (engine.enquiry). Overrides any demo handler.
  document.addEventListener('submit',function(ev){
    var f=ev.target; if(!(f&&f.tagName==='FORM'))return;
    ev.preventDefault();
    var name=val(f,'name')||val(f,'fullname'), phone=val(f,'phone')||val(f,'mobile')||val(f,'tel');
    var msg=val(f,'message')||val(f,'note')||val(f,'comments')||val(f,'reason');
    var note=f.querySelector('#formNote,.form-note,[data-note]');
    if(!SUB){ if(note)note.textContent='Preview — submissions are disabled.'; return; }
    fetch(API+'/engine/public/'+encodeURIComponent(SUB)+'/actions/engine.enquiry',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({name:name||'Website enquiry',phone:phone,message:msg||('Enquiry via '+(f.getAttribute('data-form')||'website'))})
    }).then(function(r){return r.json().catch(function(){return{};});})
      .then(function(){ if(note)note.textContent='Thank you — your request has reached the clinic. We will call you back shortly.'; try{f.reset();}catch(e){} })
      .catch(function(){ if(note)note.textContent='Could not send — please call us directly.'; });
  },true);
  // Intra-site links (rewritten to BASE/<slug>) navigate the parent window.
  addEventListener('DOMContentLoaded',function(){
    document.querySelectorAll('a[href^="'+BASE+'"], a[href^="'+location.origin+BASE+'"]').forEach(function(a){a.setAttribute('target','_top');});
  });
})();</script>`;
}

/** Assemble the full self-contained HTML document string for the iframe. */
export function buildThemeSrcDoc(
  bundle: ThemeBundle, site: FrameSite,
  opts: { subdomain: string; rest: string[]; apiBase: string; base?: string },
): string {
  const base = opts.base ?? `/site/${opts.subdomain}`;
  const slugs = new Set(bundle.pages.map((p, i) => (i === 0 ? 'home' : p.slug)));
  const requested = opts.rest[0] || 'home';
  const current = bundle.pages.find((p) => p.slug === requested)
    ?? (requested === 'home' ? bundle.pages[0] : undefined) ?? bundle.pages[0];
  const body = rewriteLinks(injectTokens(current.html, site), base, slugs);
  const fonts = (bundle.fonts ?? []).map((h) => `<link rel="stylesheet" href="${esc(h)}">`).join('\n');
  const preconnect = fonts ? '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<base target="_self">
${preconnect}
${fonts}
<style>${bundle.css ?? ''}</style>
</head><body>
${body}
${bundle.js ? `<script>${bundle.js}</script>` : ''}
${bridge(opts.apiBase, site.vendor.subdomain ? opts.subdomain : '', base)}
</body></html>`;
}

/** Render the theme as a full-viewport isolated iframe. */
export function RawThemeFrame({ srcDoc, title }: { srcDoc: string; title: string }) {
  return (
    <iframe
      title={title}
      srcDoc={srcDoc}
      // Allow the theme's own scripts + our bridge (same-origin srcdoc) to run and to
      // navigate the top window on intra-site links; forms post via fetch to our API.
      sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-top-navigation-by-user-activation"
      style={{ width: '100%', height: '100vh', border: 0, display: 'block' }}
    />
  );
}
