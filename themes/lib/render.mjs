// THE renderer. Everything that turns a theme + content into HTML calls renderPage(): the preview, the screenshots, the lint, and later the
// backend and the Theme Studio. It is a PURE function: no network, no file access, no clock, no randomness, no environment. The same input
// gives byte-identical output, and the input is never modified.
//
//   renderPage({ theme, page, content, settings, vendor, host }) -> { html, lang, seo, slots, warnings, template, variant }
//
//   theme    { manifest, templates: { home: '<html fragment>', ... }, css }     (see lib/theme.mjs)
//   page     { slug: 'home'|'about'|'services'|..., item?: {...}, parent?: 'services' }   (or just the slug string)
//   content  the vendor's content in the theme-independent model (see fixtures/index.mjs)
//   settings what a vendor may change: accent, accentDark, fontHeading, fontBody, logo, sectionOrder, hiddenSections, motionIntensity
//   vendor   { id, unclaimed? }
//   host     { siteUrl, customDomain?, allowEmbeds?, sampleImages? }       the platform's facts about where the page is served
//   entitlements { video, cart, booking, customDomain }   what the vendor's plan has switched on; each defaults to false. The theme tier does NOT decide this.
//            video, cart and booking draw nothing at all (no empty box) unless their entitlement is exactly true; customDomain lets host.customDomain be the canonical address.
import { parse, serialize } from './html.mjs';
import { ENTITLEMENT_KEYS, BINDINGS, REPEATERS, NESTED_LISTS, SLOTS, SLOT_BY_TAG, APPROVED_FONTS, MAP_EMBED_HOSTS, VIDEO_HOSTS, ALLOWED_URI_SCHEMES, MOTION_INTENSITIES } from './vocabulary.mjs';
import { categoryById, hasCategory, FAMILIES } from './categories.mjs';
import { validatePreset, presetStyle, applyPresetContent } from './preset.mjs';

// ---------------------------------------------------------------- wording
const UI = {
  en: { skip: 'Skip to main content', menu: 'Menu', close: 'Close menu', home: 'Home', about: 'About', gallery: 'Gallery', contact: 'Contact', call: 'Call', whatsapp: 'WhatsApp', directions: 'Directions', readMore: 'Read more', viewAll: 'View all', badge: 'Listed on Get4Domain', googleReviews: 'Google reviews', testimonials: 'Customer testimonials', noReviews: 'No reviews yet', viewOnGoogle: 'View on Google', writeReview: 'Write a review on Google', ownerReply: 'Reply from the owner', reviewsBased: 'based on', reviewsWord: 'reviews', outOf: 'out of 5', yourName: 'Your name', yourPhone: 'Phone number', message: 'Message', consent: 'I agree to be contacted about this enquiry', send: 'Send enquiry', enquiryTitle: 'Send an enquiry', booking: 'Request a booking', share: 'Share this site', scan: 'Scan to open this site', hoursTitle: 'Opening hours', closed: 'Closed', map: 'Map', areas: 'Service areas', videos: 'Videos', watch: 'Watch video', transcript: 'Transcript', search: 'Search', searchLabel: 'Search this site', cart: 'Cart', claim: 'Is this your business? Claim this page', privacy: 'Privacy', terms: 'Terms', ask: 'Ask about this', addToCart: 'Add to cart', hoursWord: 'Hours', whatsappFloat: 'Chat on WhatsApp', sampleBadge: 'Sample', products: 'Products', mainNav: 'Main', closeImage: 'Close picture', faq: 'Frequently asked questions', process: 'How it works' },
  ta: { skip: 'முதன்மை உள்ளடக்கத்துக்குச் செல்', menu: 'பட்டி', close: 'பட்டியை மூடு', home: 'முகப்பு', about: 'எங்களைப் பற்றி', gallery: 'படங்கள்', contact: 'தொடர்பு', call: 'அழை', whatsapp: 'வாட்ஸ்அப்', directions: 'வழி', readMore: 'மேலும் படிக்க', viewAll: 'அனைத்தும்', badge: 'Get4Domain-இல் பட்டியலிடப்பட்டுள்ளது', googleReviews: 'Google மதிப்புரைகள்', testimonials: 'வாடிக்கையாளர் கருத்துகள்', noReviews: 'இன்னும் மதிப்புரைகள் இல்லை', viewOnGoogle: 'Google-இல் பார்க்க', writeReview: 'Google-இல் மதிப்புரை எழுதுங்கள்', ownerReply: 'உரிமையாளர் பதில்', reviewsBased: 'அடிப்படை', reviewsWord: 'மதிப்புரைகள்', outOf: '5 இல்', yourName: 'உங்கள் பெயர்', yourPhone: 'தொலைபேசி எண்', message: 'செய்தி', consent: 'இந்த விசாரணை தொடர்பாக என்னைத் தொடர்புகொள்ள ஒப்புக்கொள்கிறேன்', send: 'விசாரணை அனுப்பு', enquiryTitle: 'விசாரணை அனுப்புங்கள்', booking: 'முன்பதிவு கோருங்கள்', share: 'இந்த தளத்தைப் பகிருங்கள்', scan: 'இந்த தளத்தைத் திறக்க ஸ்கேன் செய்யுங்கள்', hoursTitle: 'திறந்திருக்கும் நேரம்', closed: 'மூடப்பட்டிருக்கும்', map: 'வரைபடம்', areas: 'சேவைப் பகுதிகள்', videos: 'காணொளிகள்', watch: 'காணொளி பார்க்க', transcript: 'எழுத்து வடிவம்', search: 'தேடு', searchLabel: 'இந்த தளத்தில் தேடு', cart: 'கூடை', claim: 'இது உங்கள் வணிகமா? இந்தப் பக்கத்தை உரிமை கோருங்கள்', privacy: 'தனியுரிமை', terms: 'விதிமுறைகள்', ask: 'இதைப் பற்றி கேளுங்கள்', addToCart: 'கூடையில் சேர்', hoursWord: 'நேரம்', whatsappFloat: 'வாட்ஸ்அப்பில் அரட்டை', sampleBadge: 'மாதிரி', products: 'பொருட்கள்', mainNav: 'முதன்மை', closeImage: 'படத்தை மூடு', faq: 'அடிக்கடி கேட்கப்படும் கேள்விகள்', process: 'எப்படி செயல்படுகிறது' },
};
const UI_BINDINGS = { 'ui.skip': 'skip', 'ui.call': 'call', 'ui.whatsapp': 'whatsapp', 'ui.directions': 'directions', 'ui.menu': 'menu', 'ui.readMore': 'readMore', 'ui.viewAll': 'viewAll', 'ui.home': 'home', 'ui.about': 'about', 'ui.gallery': 'gallery', 'ui.contact': 'contact', 'ui.closeImage': 'closeImage', 'ui.faq': 'faq', 'ui.process': 'process' };

// ---------------------------------------------------------------- safe values
export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** A URL a visitor may be sent to or load from: http, https, tel, mailto, or a relative path. Anything else (javascript:, data:, //host, file:) is dropped. */
export function safeUrl(v) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  const compact = s.replace(/[\u0000- \u007f-\u009f]/g, '');
  if (compact.startsWith('//')) return '';
  const m = compact.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  if (m) return ALLOWED_URI_SCHEMES.includes(m[1].toLowerCase()) ? compact : '';
  return /^[\w./?#=&%~+-]+$/.test(compact) ? compact : '';
}
const isHttpOrRelative = (u) => u !== '' && !/^(tel|mailto):/i.test(u);
const hostOf = (u) => { try { return new URL(u).hostname.toLowerCase(); } catch { return ''; } };
const HEX = /^#[0-9a-fA-F]{6}$/;

const PALETTE = ['#cfe3dc', '#e6dcc9', '#d6dcec', '#ecd3d3', '#d9e6c8', '#e4d3e8', '#cfe6ea', '#eadfc6'];
const SIZES = { hero: [1200, 600], about: [800, 600], logo: [160, 48], gallery: [600, 400], item: [400, 300], team: [200, 200], video: [640, 360] };
function placeholder(name) {
  const key = name.slice('sample:'.length);
  const kind = key.replace(/-\d+$/, '');
  const [w, h] = SIZES[kind] ?? [600, 400];
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'><rect width='100%' height='100%' fill='${PALETTE[hash % PALETTE.length]}'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='${Math.round(h / 8)}' fill='#33403c'>sample</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
function resolveImage(v, host) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  if (s.startsWith('sample:')) return host.sampleImages === false ? '' : placeholder(s);
  const u = safeUrl(s);
  return isHttpOrRelative(u) ? u : '';
}

const URL_LAST = new Set(['href', 'url', 'phoneHref', 'whatsappHref', 'mapUrl', 'secondaryHref', 'writeUrl']);
const IMAGE_LAST = new Set(['logo', 'favicon', 'image', 'src', 'poster', 'photo']);
const RICH = new Set(['about.text', 'page.body']);
const last = (p) => p.slice(p.lastIndexOf('.') + 1);
const isUrlPath = (p) => URL_LAST.has(last(p)) || (p.startsWith('social.') && p !== 'social.customLabel') || p === 'site.url';
const isImagePath = (p) => IMAGE_LAST.has(last(p));

const BAD_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'title', 'canvas', 'audio', 'dialog', 'form', 'input', 'select', 'textarea', 'frame', 'frameset', 'applet', 'noscript']);
const URL_ATTRS = new Set(['href', 'src', 'poster', 'action', 'formaction', 'xlink:href', 'cite']);

// ---------------------------------------------------------------- context
/** Only an explicit `true` switches an entitlement on; anything else (missing, 'yes', 1) is off. */
function normalizeEntitlements(e) {
  const src = e && typeof e === 'object' ? e : {};
  return Object.fromEntries(ENTITLEMENT_KEYS.map((k) => [k, src[k] === true]));
}

function makeCtx({ theme, page, content, settings, vendor, host, entitlements }) {
  const c = content && typeof content === 'object' ? content : {};
  const p = typeof page === 'string' ? { slug: page } : page && typeof page === 'object' ? page : { slug: 'home' };
  const warnings = [];
  const warn = (w) => { if (!warnings.includes(w)) warnings.push(w); };
  const catId = hasCategory(c.category) ? c.category : theme?.manifest?.categories?.find(hasCategory);
  if (!catId) warn('unknown-category');
  const cat = catId ? categoryById(catId) : null;
  const lang = c.lang === 'ta' ? 'ta' : 'en';
  // The category preset is the DEFAULT look and starter content; the vendor's own settings and content always win (see applyPresetContent and renderPage).
  let preset = theme?.presets && cat ? theme.presets[cat.id] ?? null : null;
  if (preset) {
    const errs = validatePreset(preset, { manifest: theme.manifest });
    if (errs.length && errs.every((e) => e.code === 'font-not-in-manifest')) { warn('preset-ignored:fonts'); preset = { ...preset, fonts: null }; }
    else if (errs.length) { warn('preset-ignored:invalid'); preset = null; }
  }
  return { theme, page: p, preset, ent: normalizeEntitlements(entitlements), c: preset ? applyPresetContent(c, preset, lang) : c, settings: settings && typeof settings === 'object' ? settings : {}, vendor: vendor ?? {}, host: host ?? {}, warnings, warn, cat, lang, ui: UI[lang], scopes: [], uid: 0, slots: [], variant: cat ? FAMILIES[cat.family].variant : null };
}

const getPath = (obj, parts) => parts.reduce((o, k) => (o !== null && o !== undefined && typeof o === 'object' ? o[k] : undefined), obj);

function hoursSummary(ctx) {
  const rows = Array.isArray(ctx.c.hours) ? ctx.c.hours : [];
  const open = rows.filter((r) => r && !r.closed && r.open && r.close);
  if (!open.length) return '';
  const same = open.every((r) => r.open === open[0].open && r.close === open[0].close);
  const closedDays = rows.filter((r) => r && r.closed).map((r) => r.day).filter(Boolean);
  if (!same) return ctx.ui.hoursTitle;
  return `${open[0].open} – ${open[0].close}${closedDays.length ? `; ${ctx.ui.closed}: ${closedDays.join(', ')}` : ''}`;
}

function pageTitleDefault(ctx) {
  const { page, c, ui } = ctx;
  if (page.slug === 'item' && page.item) return page.item.name;
  if (page.slug === 'about') return c.about?.title || ui.about;
  if (page.slug === 'services') return c.terms?.items || ui.viewAll;
  if (page.slug === 'gallery') return ui.gallery;
  if (page.slug === 'contact') return ui.contact;
  return c.page?.title || c.site?.name || '';
}

/** Resolves a binding path against the loop scopes, then the content. Returns undefined when nothing is there. */
function lookup(ctx, path) {
  const parts = path.split('.');
  for (let i = ctx.scopes.length - 1; i >= 0; i--) {
    if (ctx.scopes[i].name === parts[0]) return parts.length === 1 ? ctx.scopes[i].value : getPath(ctx.scopes[i].value, parts.slice(1));
  }
  if (UI_BINDINGS[path]) return ctx.ui[UI_BINDINGS[path]];
  if (path === 'hours') return hoursSummary(ctx);
  if (path === 'hero.cta') return ctx.c.hero?.cta || ctx.c.cta?.label || ctx.cat?.ctaPrimary;
  if (path === 'cta.label') return ctx.c.cta?.label || ctx.cat?.ctaPrimary;
  if (path === 'page.title') return pageTitleDefault(ctx);
  if (path === 'page.slug') return ctx.page.slug;
  if (path.startsWith('entitlements.')) return ctx.ent[path.slice('entitlements.'.length)];
  if (path === 'site.logo' && ctx.settings.logo) return ctx.settings.logo;
  if (path === 'contact.phoneHref' && !ctx.c.contact?.phoneHref && ctx.c.contact?.phone) return `tel:${String(ctx.c.contact.phone).replace(/[^+\d]/g, '')}`;
  return getPath(ctx.c, parts);
}

const repeaterFields = (name) => REPEATERS[name]?.fields;
function varNameOf(listPath) { return REPEATERS[listPath]?.as ?? (listPath === 'group.items' ? 'item' : listPath === 'block.items' ? 'entry' : null); }
const fieldsOfVar = (v) => Object.values(REPEATERS).find((r) => r.as === v)?.fields;

/** Is `path` a name the contract knows (a content binding, or a field of an enclosing loop variable)? */
function knownBinding(ctx, path) {
  const [head, ...rest] = path.split('.');
  const scope = [...ctx.scopes].reverse().find((s) => s.name === head);
  if (scope) return rest.length === 0 || (fieldsOfVar(head)?.includes(rest[0]) ?? false);
  return BINDINGS.includes(path) || Boolean(REPEATERS[path]) || Boolean(NESTED_LISTS[path]); // a list name is allowed in data-g4d-if
}

function formatValue(ctx, path, v, { attr, nodes }) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'object') { ctx.warn(`not-text:${path}`); return ''; }
  if (typeof v === 'boolean') return '';
  if (isImagePath(path)) return esc(resolveImage(v, ctx.host));
  if (isUrlPath(path)) return esc(safeUrl(v));
  if (!attr && nodes && RICH.has(path)) {
    return String(v).split(/\n{2,}/).map((s) => s.trim()).filter(Boolean).map((s) => `<p>${esc(s).replace(/\n/g, '<br>')}</p>`).join('');
  }
  return esc(v);
}

function interp(ctx, str, opts) {
  return str.replace(/\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/g, (_m, path) => {
    if (!knownBinding(ctx, path)) { ctx.warn(`unknown-binding:${path}`); return ''; }
    const v = lookup(ctx, path);
    if ((v === undefined || v === null) && !ctx.scopes.some((s) => s.name === path.split('.')[0])) ctx.warn(`missing:${path}`);
    return formatValue(ctx, path, v, opts);
  });
}

function truthy(v) {
  if (v === undefined || v === null || v === false) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
}

// ---------------------------------------------------------------- slots
const cls = (s) => String(s ?? '').replace(/[^A-Za-z0-9_ -]/g, '').trim();
function wrap(ctx, name, tag, inner, attrs) {
  const extra = cls(attrs.class);
  ctx.slots.push({ name, rendered: true });
  return `<${tag} class="g4d-slot g4d-slot--${name}${extra ? ` ${extra}` : ''}" data-g4d-slot="${name}">${inner}</${tag}>`;
}
const stars = (n) => `<span class="g4d-stars" role="img" aria-label="${esc(n)} ${esc('/ 5')}">${'★'.repeat(Math.max(0, Math.min(5, Math.round(Number(n) || 0))))}${'☆'.repeat(5 - Math.max(0, Math.min(5, Math.round(Number(n) || 0))))}</span>`;
const link = (href, text, extra = '') => (safeUrl(href) ? `<a href="${esc(safeUrl(href))}"${extra}>${esc(text)}</a>` : '');
const nextId = (ctx, base) => `g4d-${base}-${++ctx.uid}`;

function navLinks(ctx) {
  const c = ctx.c;
  const out = [['/', ctx.ui.home, 'home']];
  if (Array.isArray(c.items) && c.items.length) out.push(['/services', c.terms?.items || ctx.ui.viewAll, 'services']);
  out.push(['/about', ctx.ui.about, 'about']);
  if (Array.isArray(c.gallery) && c.gallery.length) out.push(['/gallery', ctx.ui.gallery, 'gallery']);
  out.push(['/contact', ctx.ui.contact, 'contact']);
  for (const p of Array.isArray(c.navPages) ? c.navPages : []) if (p && safeUrl(p.href) && p.title) out.push([safeUrl(p.href), p.title, `custom-${p.href}`]);
  return out;
}

function socialItems(ctx) {
  const s = ctx.c.social ?? {};
  const names = [['instagram', 'Instagram'], ['facebook', 'Facebook'], ['youtube', 'YouTube'], ['linkedin', 'LinkedIn'], ['x', 'X'], ['whatsappChannel', 'WhatsApp channel'], ['pinterest', 'Pinterest'], ['telegram', 'Telegram']];
  const items = names.map(([k, label]) => [safeUrl(s[k]), label]).filter(([u]) => isHttpOrRelative(u));
  if (isHttpOrRelative(safeUrl(s.custom)) && s.customLabel) items.push([safeUrl(s.custom), String(s.customLabel)]);
  return items.slice(0, 8);
}
function socialHtml(ctx) {
  const items = socialItems(ctx);
  if (!items.length) return '';
  return `<ul class="g4d-social">${items.map(([u, l]) => `<li><a href="${esc(u)}" rel="noopener noreferrer me" aria-label="${esc(l)}">${esc(l)}</a></li>`).join('')}</ul>`;
}
function hoursTable(ctx) {
  const rows = Array.isArray(ctx.c.hours) ? ctx.c.hours : [];
  if (!rows.length) return '';
  return `<table class="g4d-hours__table"><caption>${esc(ctx.ui.hoursTitle)}</caption><tbody>${rows.map((r, i) => `<tr data-day="${i}"><th scope="row">${esc(r?.day)}</th><td>${r?.closed || !r?.open ? esc(ctx.ui.closed) : `${esc(r.open)} – ${esc(r.close)}`}</td></tr>`).join('')}</tbody></table>`;
}

function renderSlot(ctx, name, attrs, childNodes) {
  const { c, ui, cat, theme } = ctx;
  const site = c.site ?? {};
  const contact = c.contact ?? {};
  const cta = c.cta ?? {};
  const ecommerce = cat?.track === 'ecommerce';
  switch (name) {
    case 'header-nav': {
      const label = attrs.label ? String(attrs.label) : ui.mainNav;
      const links = navLinks(ctx).map(([href, text, key]) => `<li><a href="${esc(href)}"${key === ctx.page.slug || (key === 'home' && ctx.page.slug === 'home') ? ' aria-current="page"' : ''}>${esc(text)}</a></li>`).join('');
      return wrap(ctx, name, 'nav', `<a class="g4d-menu-open" href="#g4d-menu">${esc(ui.menu)}</a><div id="g4d-menu" class="g4d-menu"><a class="g4d-menu-close" href="#">${esc(ui.close)}</a><ul>${links}</ul></div>`, attrs).replace('<nav ', `<nav aria-label="${esc(label)}" `);
    }
    case 'action': {
      const label = attrs.label || cta.label || cat?.ctaPrimary || '';
      const href = safeUrl(cta.href) || '/enquire';
      ctx.slots.push({ name, rendered: true });
      return `<a class="g4d-slot g4d-slot--action g4d-action${cls(attrs.class) ? ` ${cls(attrs.class)}` : ''}" data-g4d-slot="action" data-track="cta" href="${esc(href)}">${esc(label)}</a>`;
    }
    case 'bottom-nav': {
      const items = [[contact.phoneHref || (contact.phone ? `tel:${String(contact.phone).replace(/[^+\d]/g, '')}` : ''), ui.call, 'call'], [contact.whatsappHref, ui.whatsapp, 'whatsapp'], [contact.mapUrl, ui.directions, 'directions']].filter(([h]) => safeUrl(h));
      return wrap(ctx, name, 'nav', `<ul>${items.map(([h, t, k]) => `<li><a href="${esc(safeUrl(h))}" data-track="${k}">${esc(t)}</a></li>`).join('')}</ul>`, attrs).replace('<nav ', `<nav aria-label="${esc(ui.call)}" `);
    }
    case 'footer': {
      const variant = ['columns', 'centered', 'minimal'].includes(attrs.variant) ? attrs.variant : 'columns';
      const addr = contact.address ? `<address>${esc(contact.address)}</address>` : '';
      const tel = contact.phone ? link(contact.phoneHref || `tel:${String(contact.phone).replace(/[^+\d]/g, '')}`, contact.phone) : '';
      const mail = contact.email ? link(`mailto:${contact.email}`, contact.email) : '';
      const html = `<div class="g4d-footer__inner"><p class="g4d-footer__name">${esc(site.name)}</p>${addr}<p>${tel}${tel && mail ? ' · ' : ''}${mail}</p>${socialHtml(ctx)}<p class="g4d-footer__legal"><a href="/legal/privacy">${esc(ui.privacy)}</a> · <a href="/legal/terms">${esc(ui.terms)}</a></p><p class="g4d-footer__copy">© ${esc(site.year ?? '')} ${esc(site.name)}</p></div>`;
      return wrap(ctx, name, 'footer', html, { class: `g4d-footer--${variant} ${attrs.class ?? ''}` });
    }
    case 'hours': return wrap(ctx, name, 'div', hoursTable(ctx) || `<p>${esc(ui.hoursTitle)}</p>`, attrs);
    case 'open-now': {
      const data = (Array.isArray(c.hours) ? c.hours : []).map((r) => [r?.closed ? 1 : 0, r?.open ?? '', r?.close ?? '']);
      return wrap(ctx, name, 'p', `<span class="g4d-open-now__label">${esc(ui.hoursWord)}:</span> <span class="g4d-open-now__text">${esc(hoursSummary(ctx) || ui.hoursTitle)}</span>`, attrs).replace('<p ', `<p data-hours="${esc(JSON.stringify(data))}" aria-live="polite" `);
    }
    case 'map': {
      const lat = Number(contact.lat); const lng = Number(contact.lng);
      let embed = '';
      if (ctx.host.allowEmbeds && Number.isFinite(lat) && Number.isFinite(lng) && contact.lat !== '' && contact.lat != null) {
        const src = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01}%2C${lat - 0.01}%2C${lng + 0.01}%2C${lat + 0.01}&layer=mapnik&marker=${lat}%2C${lng}`;
        if (MAP_EMBED_HOSTS.includes(hostOf(src))) embed = `<iframe class="g4d-map__frame" src="${esc(src)}" title="${esc(ui.map)}" width="600" height="338" loading="lazy" referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin"></iframe>`;
      }
      const chips = !contact.address && Array.isArray(c.areas) && c.areas.length ? `<ul class="g4d-map__areas" aria-label="${esc(ui.areas)}">${c.areas.map((a) => `<li>${esc(a?.name)}</li>`).join('')}</ul>` : '';
      const dir = link(contact.mapUrl, ui.directions, ' class="g4d-map__directions" data-track="directions" rel="noopener noreferrer"');
      return wrap(ctx, name, 'div', `${embed}${contact.address ? `<p class="g4d-map__address">${esc(contact.address)}</p>` : ''}${chips}${dir}`, attrs);
    }
    case 'social-links': {
      const html = socialHtml(ctx);
      return html ? wrap(ctx, name, 'div', html, attrs) : (ctx.slots.push({ name, rendered: false }), '');
    }
    case 'reviews': {
      const r = c.reviews && typeof c.reviews === 'object' ? c.reviews : {};
      const g = Array.isArray(r.google) ? r.google : [];
      const t = Array.isArray(c.testimonials) ? c.testimonials : [];
      const sample = r.sample ? ` <span class="g4d-sample">${esc(ui.sampleBadge)}</span>` : '';
      let inner = '';
      if (g.length) {
        const sum = r.summary && Number(r.summary.count) > 0 ? `<p class="g4d-reviews__summary">${stars(r.summary.rating)} <strong>${esc(r.summary.rating)}</strong> ${esc(ui.outOf)} · ${esc(ui.reviewsBased)} ${esc(r.summary.count)} ${esc(ui.reviewsWord)}</p>` : '';
        inner += `<section class="g4d-reviews__google" aria-label="${esc(ui.googleReviews)}"><h2>${esc(ui.googleReviews)}${sample}</h2>${sum}<ul class="g4d-reviews__list">${g.map((x) => `<li class="g4d-review"><article><p class="g4d-review__head"><strong>${esc(x?.name)}</strong> ${stars(x?.rating)}${x?.date ? ` <time datetime="${esc(x.date)}">${esc(x.date)}</time>` : ''}</p><p class="g4d-review__text">${esc(x?.text)}</p>${x?.reply ? `<p class="g4d-review__reply"><strong>${esc(ui.ownerReply)}:</strong> ${esc(x.reply)}</p>` : ''}</article></li>`).join('')}</ul>${link(contact.mapUrl, ui.viewOnGoogle, ' rel="noopener noreferrer"')}</section>`;
      }
      if (t.length) {
        inner += `<section class="g4d-reviews__testimonials" aria-label="${esc(ui.testimonials)}"><h2>${esc(ui.testimonials)}</h2><ul class="g4d-reviews__list">${t.map((x) => `<li class="g4d-review"><figure><blockquote>${esc(x?.quote)}</blockquote><figcaption>${esc(x?.author)}${x?.note ? `, ${esc(x.note)}` : ''}</figcaption></figure></li>`).join('')}</ul></section>`;
      }
      if (!g.length && !t.length) inner = `<p class="g4d-reviews__empty">${esc(ui.noReviews)}</p>`;
      if (safeUrl(r.writeUrl)) inner += `<p><a class="g4d-reviews__write" href="${esc(safeUrl(r.writeUrl))}" rel="noopener noreferrer">${esc(ui.writeReview)}</a></p>`;
      return wrap(ctx, name, 'section', inner, attrs);
    }
    case 'video': {
      if (!ctx.ent.video) { ctx.slots.push({ name, rendered: false }); return ''; }
      const vids = (Array.isArray(c.videos) ? c.videos : []).filter((v) => VIDEO_HOSTS.includes(hostOf(safeUrl(v?.url)))).slice(0, 6);
      if (!vids.length) { ctx.slots.push({ name, rendered: false }); return ''; }
      const html = `<h2>${esc(ui.videos)}</h2><ul class="g4d-video__list">${vids.map((v) => { const poster = resolveImage(v.poster, ctx.host); return `<li class="g4d-video"><a class="g4d-video__facade" href="${esc(safeUrl(v.url))}" target="_blank" rel="noopener noreferrer" aria-label="${esc(ui.watch)}: ${esc(v.title)}">${poster ? `<img src="${esc(poster)}" alt="" role="presentation" width="640" height="360" loading="lazy">` : '<span class="g4d-video__nopic" aria-hidden="true">▶</span>'}<span class="g4d-video__title">${esc(v.title)}</span>${v.duration ? `<span class="g4d-video__duration">${esc(v.duration)}</span>` : ''}</a>${v.transcript ? `<details><summary>${esc(ui.transcript)}</summary><p>${esc(v.transcript)}</p></details>` : ''}</li>`; }).join('')}</ul>`;
      return wrap(ctx, name, 'section', html, attrs);
    }
    case 'enquiry-form': {
      const id = (k) => nextId(ctx, `e-${k}`);
      const [n, p, m, k] = [id('name'), id('phone'), id('msg'), id('ok')];
      const html = `<h2>${esc(ui.enquiryTitle)}</h2><form class="g4d-form" method="post" action="/enquire"><p><label for="${n}">${esc(ui.yourName)}</label><input id="${n}" name="name" type="text" autocomplete="name" required></p><p><label for="${p}">${esc(ui.yourPhone)}</label><input id="${p}" name="phone" type="tel" autocomplete="tel" required></p><p><label for="${m}">${esc(ui.message)}</label><textarea id="${m}" name="message" rows="4"></textarea></p><p class="g4d-form__consent"><input id="${k}" name="consent" type="checkbox" required><label for="${k}">${esc(ui.consent)}</label></p><input type="hidden" name="source" value="site"><p><button type="submit" class="g4d-btn">${esc(ui.send)}</button></p></form>`;
      return wrap(ctx, name, 'section', html, attrs);
    }
    case 'whatsapp-float': {
      const href = safeUrl(contact.whatsappHref);
      if (!href) { ctx.slots.push({ name, rendered: false }); return ''; }
      ctx.slots.push({ name, rendered: true });
      return `<a class="g4d-slot g4d-slot--whatsapp-float${cls(attrs.class) ? ` ${cls(attrs.class)}` : ''}" data-g4d-slot="whatsapp-float" data-track="whatsapp" href="${esc(href)}" rel="noopener noreferrer" aria-label="${esc(ui.whatsappFloat)}">${esc(ui.whatsapp)}</a>`;
    }
    case 'booking': if (!ctx.ent.booking) { ctx.slots.push({ name, rendered: false }); return ''; } return wrap(ctx, name, 'section', `<h2>${esc(ui.booking)}</h2><p><a class="g4d-btn" href="/book">${esc(cta.label || cat?.ctaPrimary || ui.booking)}</a></p>`, attrs);
    case 'product-grid': {
      const prods = Array.isArray(c.products) ? c.products : [];
      if (!ecommerce || !prods.length) { ctx.slots.push({ name, rendered: false }); return ''; }
      const html = `<h2>${esc(c.terms?.items || ui.products)}</h2><ul class="g4d-products">${prods.slice(0, 24).map((p) => { const img = resolveImage(p?.image, ctx.host); return `<li class="g4d-product">${img ? `<img src="${esc(img)}" alt="${esc(p?.name)}" width="400" height="300" loading="lazy">` : ''}<h3>${esc(p?.name)}</h3><p class="g4d-product__price">${esc(p?.price)}</p>${ctx.ent.cart ? `<a class="g4d-btn" href="/cart?add=${encodeURIComponent(String(p?.id ?? ''))}">${esc(ui.addToCart)}</a>` : `<a href="/enquire?item=${encodeURIComponent(String(p?.id ?? ''))}">${esc(ui.ask)}</a>`}</li>`; }).join('')}</ul>`;
      return wrap(ctx, name, 'section', html, attrs);
    }
    case 'cart': {
      if (!ctx.ent.cart) { ctx.slots.push({ name, rendered: false }); return ''; }
      return wrap(ctx, name, 'div', `<a class="g4d-cart" href="/cart">${esc(attrs.label || ui.cart)}</a>`, attrs);
    }
    case 'search': {
      const id = nextId(ctx, 'search');
      return wrap(ctx, name, 'div', `<form role="search" method="get" action="/search"><label for="${id}">${esc(ui.searchLabel)}</label><input id="${id}" name="q" type="search"><button type="submit" class="g4d-btn">${esc(ui.search)}</button></form>`, attrs);
    }
    case 'claim-banner': {
      if (!ctx.vendor.unclaimed) { ctx.slots.push({ name, rendered: false }); return ''; }
      return wrap(ctx, name, 'div', `<p><a href="/claim">${esc(ui.claim)}</a></p>`, attrs);
    }
    case 'listed-on-badge': return wrap(ctx, name, 'div', `<a class="g4d-badge" href="https://get4domain.com/?ref=badge" rel="noopener">${esc(ui.badge)}</a>`, attrs);
    case 'share-qr': {
      const url = siteBase(ctx) || site.url || '';
      const enc = encodeURIComponent(url);
      const links = url ? `<ul class="g4d-share__links"><li><a href="https://wa.me/?text=${enc}" rel="noopener noreferrer">${esc(ui.whatsapp)}</a></li><li><a href="https://www.facebook.com/sharer/sharer.php?u=${enc}" rel="noopener noreferrer">Facebook</a></li></ul><p class="g4d-share__url">${esc(url)}</p>` : '';
      return wrap(ctx, name, 'div', `<p class="g4d-share__title">${esc(ui.share)}</p>${links}<img class="g4d-share__qr" src="/_qr.svg" alt="${esc(ui.scan)}" width="160" height="160" loading="lazy">`, attrs);
    }
    case 'bottom-tabs':
    default: return '';
  }
}

// ---------------------------------------------------------------- tree rendering
function renderNodes(ctx, nodes) {
  const out = [];
  for (const n of nodes) {
    if (n.type === 'comment') continue;
    if (n.type === 'text' || n.type === 'raw') { out.push(n.type === 'text' ? { type: 'text', value: interp(ctx, n.value, { attr: false, nodes: true }) } : n); continue; }
    const tag = n.tag;
    if (BAD_TAGS.has(tag)) { ctx.warn(`element-removed:${tag}`); continue; }

    if (tag === 'template' && 'data-g4d-each' in n.attrs) { out.push(...renderLoop(ctx, n)); continue; }

    if (tag.startsWith('g4d-')) {
      const slot = SLOT_BY_TAG[tag];
      if (!slot) { ctx.warn(`unknown-slot:${tag}`); continue; }
      if (slot === 'tabs') { out.push(...renderTabs(ctx, n)); continue; }
      const html = renderSlot(ctx, slot, n.attrs, n.children);
      if (html) out.push({ type: 'raw', value: html });
      continue;
    }

    if ('data-g4d-if' in n.attrs && !truthy(lookupForTest(ctx, n.attrs['data-g4d-if']))) continue;
    if ('data-g4d-if-not' in n.attrs && truthy(lookupForTest(ctx, n.attrs['data-g4d-if-not']))) continue;

    const attrs = {};
    const order = [];
    for (const name of n.order) {
      if (['data-g4d-each', 'data-g4d-as', 'data-g4d-if', 'data-g4d-if-not'].includes(name)) continue;
      const raw = n.attrs[name];
      if (/^on/i.test(name)) { ctx.warn(`inline-handler-removed:${name}`); continue; }
      if (name === 'style' && raw.includes('{{')) { ctx.warn('binding-in-style-removed'); continue; }
      let v = raw.includes('{{') ? interp(ctx, raw, { attr: true, nodes: false }) : raw;
      if (URL_ATTRS.has(name) && v !== '' && !raw.includes('{{')) { v = safeUrl(v); }
      attrs[name] = v;
      order.push(name);
    }
    if (tag === 'img' && (attrs.src === undefined || attrs.src === '')) { ctx.warn('empty-image-dropped'); continue; }
    out.push({ type: 'el', tag, attrs, order, children: renderNodes(ctx, n.children), selfClosed: false });
  }
  return out;
}

function lookupForTest(ctx, path) {
  if (!knownBinding(ctx, path)) { ctx.warn(`unknown-binding:${path}`); return undefined; }
  const v = lookup(ctx, path);
  // a link or picture that would be dropped as unsafe counts as empty, so its block is hidden too
  if (typeof v === 'string' && isImagePath(path)) return resolveImage(v, ctx.host);
  if (typeof v === 'string' && isUrlPath(path)) return safeUrl(v);
  return v;
}

function renderLoop(ctx, n) {
  const listPath = n.attrs['data-g4d-each'];
  const known = REPEATERS[listPath] || NESTED_LISTS[listPath];
  if (!known) { ctx.warn(`unknown-list:${listPath}`); return []; }
  let list;
  if (listPath === 'pages') list = navLinks(ctx).map(([href, title]) => ({ href, title }));
  else list = lookup(ctx, listPath);
  if (list === undefined || list === null) { ctx.warn(`missing:${listPath}`); return []; }
  if (!Array.isArray(list)) { ctx.warn(`not-a-list:${listPath}`); return []; }
  const name = n.attrs['data-g4d-as'] || varNameOf(listPath);
  const out = [];
  for (const [i, item] of list.entries()) {
    ctx.scopes.push({ name, value: item && typeof item === 'object' && !Array.isArray(item) && item.n === undefined ? { ...item, n: i + 1 } : item });
    out.push(...renderNodes(ctx, n.children));
    ctx.scopes.pop();
  }
  return out;
}

function renderTabs(ctx, n) {
  const groups = Array.isArray(ctx.c.groups) ? ctx.c.groups : [];
  const tpl = n.children.find((x) => x.type === 'el' && x.tag === 'template');
  const panels = [];
  for (const g of groups) {
    ctx.scopes.push({ name: 'group', value: g });
    panels.push(`<div class="g4d-tabs__panel ${cls(n.attrs['panel-class'])}"><h3 class="${cls(n.attrs['tab-class'])}">${esc(g?.name)}</h3>${tpl ? serialize(renderNodes(ctx, tpl.children)) : ''}</div>`);
    ctx.scopes.pop();
  }
  ctx.slots.push({ name: 'tabs', rendered: true });
  return [{ type: 'raw', value: `<div class="g4d-slot g4d-slot--tabs ${cls(n.attrs.class)}" data-g4d-slot="tabs">${panels.join('')}</div>` }];
}

// ---------------------------------------------------------------- sections (vendor order and visibility)
function applySections(nodes, settings, ctx) {
  const hidden = new Set(Array.isArray(settings.hiddenSections) ? settings.hiddenSections.map(String) : []);
  const order = Array.isArray(settings.sectionOrder) ? settings.sectionOrder.map(String) : [];
  const isSection = (n) => n.type === 'el' && 'data-g4d-section' in n.attrs;
  const optional = (n) => n.attrs['data-g4d-section'] !== 'hero' && n.attrs['data-g4d-optional'] !== 'false';
  const visit = (list) => {
    let kids = list.filter((n) => !(isSection(n) && hidden.has(n.attrs['data-g4d-section']) && optional(n)));
    const secs = kids.filter(isSection);
    if (secs.length > 1 && order.length) {
      const movable = secs.filter(optional);
      const ranked = [...order.map((id) => movable.find((s) => s.attrs['data-g4d-section'] === id)).filter(Boolean), ...movable.filter((s) => !order.includes(s.attrs['data-g4d-section']))];
      let k = 0;
      kids = kids.map((n) => (isSection(n) && optional(n) ? ranked[k++] : n));
    }
    for (const n of kids) if (n.type === 'el') n.children = visit(n.children);
    return kids;
  };
  return visit(nodes);
}

// ---------------------------------------------------------------- SEO inputs
const cut = (s, max) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); if (t.length <= max) return t; const w = t.slice(0, max - 1).replace(/\s+\S*$/, ''); return `${w || t.slice(0, max - 1)}…`; };
const DAY_EN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** The address pages are served from: the vendor's own domain only when the customDomain entitlement is on and the platform gave an https origin. */
function siteBase(ctx) {
  const custom = String(ctx.host.customDomain ?? '').replace(/\/+$/, '');
  if (ctx.ent.customDomain && /^https:\/\/[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i.test(custom)) return custom;
  return String(ctx.host.siteUrl ?? '').replace(/\/+$/, '');
}

function buildSeo(ctx) {
  const { c, page, cat, host, lang } = ctx;
  const site = c.site ?? {};
  const base = siteBase(ctx);
  if (!base) ctx.warn('missing:host.siteUrl');
  const path = page.slug === 'home' || !page.slug ? '/' : page.slug === 'item' && page.item ? `/${page.parent || 'services'}/${page.item.slug || page.item.id}` : `/${page.slug}`;
  const enHref = base ? `${base}${path}` : '';
  const taHref = base ? `${base}/ta${path === '/' ? '' : path}` : '';
  const city = c.contact?.city ?? '';
  const titleBase = page.slug === 'home' || !page.slug ? [site.name, cat ? `${cat.label}${city ? ` ${lang === 'ta' ? '-' : 'in'} ${city}` : ''}` : c.hero?.title] : [pageTitleDefault(ctx), site.name];
  const title = cut(titleBase.filter(Boolean).join(' | '), 70);
  const descSrc = page.slug === 'item' && page.item?.description ? page.item.description : page.slug === 'about' ? String(c.about?.text ?? '').split(/\n+/)[0] : [c.site?.tagline, c.hero?.subtitle].filter(Boolean).join('. ');
  const description = cut(descSrc || c.about?.text, 160);

  const sd = { '@context': 'https://schema.org', '@type': cat?.schemaType ?? 'LocalBusiness', name: site.name || undefined, description: cut(c.about?.text, 300) || undefined, url: base || undefined, telephone: c.contact?.phone || undefined, email: c.contact?.email || undefined };
  const img = [c.hero?.image, c.site?.logo].map((v) => safeUrl(v)).find((u) => /^https?:/i.test(u));
  if (img) sd.image = img;
  if (c.contact?.address) sd.address = { '@type': 'PostalAddress', streetAddress: c.contact.address, addressLocality: c.contact.city || undefined, postalCode: c.contact.pin || undefined, addressCountry: 'IN' };
  if (c.contact?.lat !== undefined && c.contact?.lat !== '' && Number.isFinite(Number(c.contact.lat)) && Number.isFinite(Number(c.contact.lng))) sd.geo = { '@type': 'GeoCoordinates', latitude: Number(c.contact.lat), longitude: Number(c.contact.lng) };
  const spec = (Array.isArray(c.hours) ? c.hours : []).map((r, i) => (r && !r.closed && r.open && r.close ? { '@type': 'OpeningHoursSpecification', dayOfWeek: DAY_EN[i % 7], opens: r.open, closes: r.close } : null)).filter(Boolean);
  if (spec.length) sd.openingHoursSpecification = spec;
  const same = socialItems(ctx).map(([u]) => u);
  if (same.length) sd.sameAs = same;
  if (!c.contact?.address && Array.isArray(c.areas) && c.areas.length) sd.areaServed = c.areas.map((a) => a?.name).filter(Boolean);
  for (const k of Object.keys(sd)) if (sd[k] === undefined || sd[k] === '') delete sd[k];
  // Deliberately no aggregateRating and no review markup: reviews on the owner's own business are display only.

  return {
    title, description,
    canonical: lang === 'ta' ? taHref : enHref,
    structuredData: sd,
    hreflang: base ? [{ lang: 'en-IN', href: enHref }, { lang: 'ta-IN', href: taHref }, { lang: 'x-default', href: enHref }] : [],
  };
}

// ---------------------------------------------------------------- the one function
export function renderPage(input) {
  const ctx = makeCtx(input);
  const { theme, page, settings } = ctx;
  const templateName = page.template || page.slug || 'home';
  const src = theme?.templates?.[templateName];
  if (typeof src !== 'string') ctx.warn(`missing-template:${templateName}`);

  if (page.slug === 'item' && page.item) ctx.scopes.push({ name: 'item', value: page.item });
  let tree = typeof src === 'string' ? renderNodes(ctx, parse(src)) : [];
  tree = applySections(tree, { sectionOrder: settings.sectionOrder ?? ctx.preset?.sections?.order, hiddenSections: settings.hiddenSections ?? ctx.preset?.sections?.hidden }, ctx);
  const body = serialize(tree);

  // vendor settings -> wrapper attributes
  const m = theme?.manifest ?? {};
  // Wrapper style variables: the preset's palette and fonts first, then the vendor's settings on top (same variable replaces the preset's).
  const style = new Map();
  const fontVar = (name) => `'${name}',var(--g4d-font-fallback,system-ui,sans-serif)`;
  if (ctx.preset) {
    for (const kv of presetStyle(ctx.preset).split(';')) { const i = kv.indexOf(':'); style.set(kv.slice(0, i), kv.slice(i + 1)); }
    if (ctx.preset.fonts) { style.set('--g4d-font-heading', fontVar(ctx.preset.fonts.heading)); style.set('--g4d-font-body', fontVar(ctx.preset.fonts.body)); }
  }
  if (settings.accent !== undefined) { if (HEX.test(settings.accent)) style.set('--g4d-pal-accent', settings.accent); else ctx.warn('setting-ignored:accent'); }
  if (settings.accentDark !== undefined) { if (HEX.test(settings.accentDark)) style.set('--g4d-pal-accent-d', settings.accentDark); else ctx.warn('setting-ignored:accentDark'); }
  for (const k of ['fontHeading', 'fontBody']) {
    if (settings[k] === undefined) continue;
    if (APPROVED_FONTS.includes(settings[k]) && (m.fonts ?? []).includes(settings[k])) style.set(`--g4d-font-${k === 'fontHeading' ? 'heading' : 'body'}`, fontVar(settings[k]));
    else ctx.warn(`setting-ignored:${k}`);
  }
  if (settings.layoutVariant !== undefined) ctx.warn('setting-ignored:layoutVariant');
  let motion = ctx.variant?.motion ?? 'Low';
  const fromTheme = m.motion?.variantDefaults?.[ctx.variant?.id] ?? m.motion?.default;
  if (MOTION_INTENSITIES.includes(fromTheme)) motion = fromTheme;
  if (settings.motionIntensity !== undefined) { if (MOTION_INTENSITIES.includes(settings.motionIntensity)) motion = settings.motionIntensity; else ctx.warn('setting-ignored:motionIntensity'); }

  const v = ctx.variant;
  const lang = ctx.lang === 'ta' ? 'ta-IN' : 'en-IN';
  const attrs = [
    `class="g4d-theme g4d-theme-${esc(m.id ?? 'theme')}"`, `lang="${lang}"`,
    v ? `data-variant="${esc(v.id)}" data-hero="${esc(v.hero)}" data-header="${esc(v.header)}" data-services="${esc(v.services)}" data-card="${esc(v.card)}" data-divider="${esc(v.divider)}" data-decor="${esc(v.decor)}"` : '',
    `data-motion="${motion.toLowerCase()}"`,
    ctx.preset?.hero?.pattern ? `data-pattern="${esc(ctx.preset.hero.pattern)}"` : '',
    style.size ? `style="${[...style].map(([k, val]) => `${k}:${val}`).join(';')}"` : '',
  ].filter(Boolean).join(' ');
  const html = `<div ${attrs}>${body}</div>`;

  return { html, lang, seo: buildSeo(ctx), slots: ctx.slots, warnings: ctx.warnings, template: templateName, variant: v };
}
