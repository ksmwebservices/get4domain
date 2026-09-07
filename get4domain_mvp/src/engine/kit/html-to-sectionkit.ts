import type { KitSection, EnquiryTab } from './model';
import type { ThemeTokens, EngineActionSpec } from '../types';
import { OPERATIONS, type OperationKey } from '@/config/operations';
import { getIndustryExperience } from '@/config/industry-experience';

/**
 * HTML → Section-Kit converter (browser-side; uses DOMParser). Turns an uploaded static
 * theme (Bolt/designer) into the EXISTING data-driven section-kit `layout` — so a
 * converted theme is indistinguishable in the DB from a hand-built one and inherits the
 * live catalog loop (showcase → vendor products), cart/checkout, and enquiry operations
 * with NO new backend code. Fidelity is best-effort: the converted site adopts the
 * theme's palette/typography and section order, rendered through kit components (not a
 * pixel clone — that's the raw-HTML path).
 *
 * Robust by design: never throws; always returns a valid, renderable layout, degrading
 * to sensible per-industry defaults when the HTML can't be classified confidently.
 */

export interface ConvertOptions {
  industry: string;
  pickers: { primary: string; accent: string; radius: string };
  /** A CSS selector the admin marked as the product/catalog grid (optional). */
  catalogSelector?: string;
  sharedCss?: string;
}

export interface DetectedSection {
  role: 'hero' | 'catalog' | 'about' | 'contact' | 'other';
  title: string;
  selector: string; // best-effort selector for admin re-marking
  preview: string;   // short text preview
}

export interface ConvertResult {
  cssVars: Record<string, string>;
  layout: {
    theme: ThemeTokens;
    brandDefaults: { name: string; tagline: string; about: string };
    choices: string[];
    choiceLabel: string;
    nav: { href: string; label: string }[];
    bottomNav: { label: string; icon: string; href: string; emphasis?: boolean }[];
    primaryCta: EngineActionSpec;
    sections: KitSection[];
  };
  detected: DetectedSection[];
  notes: string[];
}

const txt = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

/** First non-empty match of a set of selectors within a scope. */
function pick(scope: ParentNode, selectors: string[]): Element | null {
  for (const s of selectors) {
    const el = scope.querySelector(s);
    if (el && txt(el)) return el;
  }
  return null;
}

/** Best-effort theme tokens: prefer CSS custom props / declared colours, else pickers. */
function extractTheme(doc: Document, css: string, pickers: ConvertOptions['pickers']): ThemeTokens {
  const styleText = css + '\n' + Array.from(doc.querySelectorAll('style')).map((s) => s.textContent ?? '').join('\n');
  const varOf = (names: string[]): string | undefined => {
    for (const n of names) {
      const m = styleText.match(new RegExp(`--${n}\\s*:\\s*([^;}]+)`, 'i'));
      if (m) return m[1].trim();
    }
    return undefined;
  };
  const fontMatch = styleText.match(/font-family\s*:\s*([^;}]+)/i);
  const font = fontMatch ? fontMatch[1].trim().replace(/["']/g, '') : '';
  const accent = varOf(['primary', 'accent', 'brand', 'color-primary']) || pickers.primary || '#2563eb';
  const accent2 = varOf(['accent', 'secondary', 'accent2']) || pickers.accent || accent;
  const radius = varOf(['radius', 'border-radius']) || pickers.radius || '14px';
  const bodyBgMatch = styleText.match(/body\s*\{[^}]*background(?:-color)?\s*:\s*([^;}]+)/i);
  const bg = (bodyBgMatch?.[1]?.trim()) || '#ffffff';
  const dark = /#(0|1|2)[0-9a-f]{2}|rgb\(\s*[0-3]?\d\b/i.test(bg);
  const fontStack = font ? `${font}, system-ui, sans-serif` : 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  return {
    bg, fg: dark ? '#f8fafc' : '#0f172a',
    surface: dark ? '#111827' : '#f8fafc', border: dark ? '#1f2937' : '#e5e7eb',
    muted: dark ? '#94a3b8' : '#64748b',
    accent, accentFg: '#ffffff', accent2,
    fontDisplay: fontStack, fontBody: fontStack, radius,
    mode: dark ? 'dark' : 'light',
  };
}

/** Candidate top-level blocks to classify. */
function blocks(doc: Document): Element[] {
  const scope = doc.querySelector('main') ?? doc.body ?? doc.documentElement;
  const direct = Array.from(scope.children).filter((e) => ['SECTION', 'HEADER', 'FOOTER', 'DIV', 'ARTICLE'].includes(e.tagName));
  const sections = Array.from(doc.querySelectorAll('section, header, footer'));
  // Prefer explicit <section>/<header>/<footer>; fall back to direct body children.
  return (sections.length ? sections : direct).slice(0, 12);
}

/** A block "looks like" a product/catalog grid if it repeats ≥3 similar card children. */
function looksLikeGrid(el: Element): boolean {
  const kids = Array.from(el.children);
  const cardish = kids.filter((k) => k.querySelector('img') || /card|item|product|menu|tile|col/i.test(k.className));
  if (cardish.length >= 3) return true;
  // one wrapper holding the repeated cards
  for (const k of kids) {
    const gk = Array.from(k.children).filter((c) => c.querySelector('img') || /card|item|product|menu|tile/i.test(c.className));
    if (gk.length >= 3) return true;
  }
  return false;
}

const heading = (el: Element): string => txt(pick(el, ['h1', 'h2', 'h3', '[class*="title"]', '[class*="heading"]']));
const selectorFor = (el: Element, i: number): string => {
  if (el.id) return `#${el.id}`;
  const cls = (el.className || '').toString().split(/\s+/).filter(Boolean)[0];
  return cls ? `${el.tagName.toLowerCase()}.${cls}` : `${el.tagName.toLowerCase()}:nth-of-type(${i + 1})`;
};

/** Map an operation key → a section-kit enquiry tab (real intent, public-safe). */
const SAFE_INTENTS = new Set(['engine.enquiry', 'realestate.site_visit', 'realestate.enquiry']);
function opToTab(opKey: OperationKey): EnquiryTab {
  const op = OPERATIONS[opKey];
  const isBooking = ['appointment', 'booking', 'site_visit', 'service_request'].includes(opKey);
  const isTxn = ['order', 'cart', 'payment', 'membership', 'subscription', 'pos'].includes(opKey);
  const intent = op.actionIntent && SAFE_INTENTS.has(op.actionIntent) ? op.actionIntent : 'engine.enquiry';
  const kind: EngineActionSpec['kind'] = isBooking ? 'booking' : isTxn ? 'payment' : 'enquiry';
  const fields: EnquiryTab['fields'] = isBooking ? ['date', 'message'] : ['message'];
  return { key: opKey, label: op.label, icon: isBooking ? 'Calendar' : 'MessageSquare', action: { intent, label: op.cta, kind }, fields, submitLabel: op.cta };
}

/** Detect which operations the HTML's buttons imply (by their text), constrained to the industry's ops. */
function detectOps(doc: Document, industry: string): OperationKey[] {
  const exp = getIndustryExperience(industry);
  const allowed = new Set<OperationKey>([exp.primaryOperation, ...exp.secondaryOperations]);
  const labels = Array.from(doc.querySelectorAll('a, button')).map((b) => txt(b).toLowerCase());
  const hit = (re: RegExp) => labels.some((l) => re.test(l));
  const found: OperationKey[] = [];
  const map: [RegExp, OperationKey][] = [
    [/add to cart|buy|shop|order/, 'order'],
    [/book(ing)?|reserve|schedule/, 'booking'],
    [/appointment/, 'appointment'],
    [/site visit|visit/, 'site_visit'],
    [/quote|estimate/, 'quote'],
    [/enquir|inquir|contact|get in touch/, 'enquiry'],
    [/apply|admission/, 'application'],
    [/join|member/, 'membership'],
    [/consult/, 'consultation'],
  ];
  for (const [re, op] of map) if (hit(re) && allowed.has(op) && !found.includes(op)) found.push(op);
  // Always ensure the industry's primary operation is present (inject if the HTML had none).
  if (!found.includes(exp.primaryOperation)) found.unshift(exp.primaryOperation);
  return found.slice(0, 4);
}

export function htmlToSectionKit(pages: { slug: string; title: string; html: string }[], opts: ConvertOptions): ConvertResult {
  const notes: string[] = [];
  const home = pages[0]?.html ?? '<body></body>';
  const doc = new DOMParser().parseFromString(home, 'text/html');
  const theme = extractTheme(doc, opts.sharedCss ?? '', opts.pickers);
  const exp = getIndustryExperience(opts.industry);

  const cand = blocks(doc);
  const detected: DetectedSection[] = [];
  const sections: KitSection[] = [];
  let heroDone = false;
  let catalogDone = false;

  // Admin-marked catalog element (wins over auto-detect).
  const marked = opts.catalogSelector ? doc.querySelector(opts.catalogSelector) : null;

  cand.forEach((el, i) => {
    const h = heading(el) || el.getAttribute('aria-label') || '';
    const sel = selectorFor(el, i);
    const isFooter = el.tagName === 'FOOTER';
    const hasContact = !!el.querySelector('a[href^="tel:"], a[href^="mailto:"], form') || /contact/i.test(h);
    const isCatalog = (marked ? el === marked || el.contains(marked) : false) || (!catalogDone && looksLikeGrid(el));
    const isHero = !heroDone && (el.tagName === 'HEADER' || !!el.querySelector('h1') || i === 0);

    if (isCatalog && !catalogDone) {
      catalogDone = true;
      detected.push({ role: 'catalog', title: h || 'Catalogue', selector: sel, preview: heading(el) });
      const img = el.querySelector('img');
      const seed = Array.from(el.querySelectorAll('h2,h3,[class*="title"]')).slice(1, 4).map((t) => ({ title: txt(t) || 'Item' }));
      sections.push({
        type: 'showcase', id: 'catalog', variant: exp.primaryOperation === 'order' && exp.group === 'Restaurant & Food' ? 'menu' : 'cards',
        eyebrow: exp.label, title: h || `Our ${exp.primaryOperation === 'order' ? 'menu' : 'offerings'}`,
        items: seed.length ? seed : [{ title: 'Sample item' }],
        ...(img ? {} : {}),
      });
      return;
    }
    if (isHero) {
      heroDone = true;
      detected.push({ role: 'hero', title: h || 'Hero', selector: sel, preview: heading(el) });
      const img = el.querySelector('img')?.getAttribute('src') || '';
      sections.push({
        type: 'hero', variant: 'overlay',
        eyebrow: exp.label, headline: h || '{{businessName}}', subline: txt(pick(el, ['p', '[class*="sub"]'])) || '{{tagline}}',
        image: /^https?:|^data:/.test(img) ? img : '',
        ctaPrimary: { label: exp.primaryCta, href: '#enquiry' },
      });
      return;
    }
    if (hasContact || isFooter) {
      if (!isFooter) detected.push({ role: 'contact', title: h || 'Contact', selector: sel, preview: txt(el).slice(0, 80) });
      return; // footer + enquiry block cover contact
    }
    // Longer text block → About (cta band).
    const body = txt(el);
    if (body.length > 120 && h) {
      detected.push({ role: 'about', title: h, selector: sel, preview: body.slice(0, 80) });
      sections.push({ type: 'cta', id: `about-${i}`, title: h, sub: body.slice(0, 280) });
      return;
    }
    detected.push({ role: 'other', title: h || el.tagName.toLowerCase(), selector: sel, preview: body.slice(0, 60) });
  });

  // Guarantees: a hero and a catalog (this is the "catalog theme" path).
  if (!heroDone) {
    sections.unshift({ type: 'hero', variant: 'overlay', eyebrow: exp.label, headline: '{{businessName}}', subline: '{{tagline}}', image: '', ctaPrimary: { label: exp.primaryCta, href: '#enquiry' } });
    notes.push('No hero detected — injected a default hero bound to your business name/tagline.');
  }
  if (!catalogDone) {
    sections.push({ type: 'showcase', id: 'catalog', variant: 'cards', eyebrow: exp.label, title: 'Our offerings', items: [{ title: 'Sample item' }] });
    notes.push('No product/catalog grid detected — injected a live product showcase. Mark the correct grid to override.');
  }

  // Operations: enquiry block wired to the industry's ops (+ any detected buttons).
  const ops = detectOps(doc, opts.industry);
  const tabs = ops.map(opToTab);
  sections.push({
    type: 'enquiry', id: 'enquiry', eyebrow: 'Get in touch',
    title: `Contact ${'{{businessName}}'}`, sub: 'Send your details and we’ll get back to you.',
    tabs,
  });
  notes.push(`Wired operations: ${ops.join(', ')} (cart/checkout auto-enables when the vendor turns on payments).`);
  if (pages.length > 1) notes.push(`${pages.length} pages uploaded — converted the home page to a single rich section-kit page (section-kit is single-page; extra pages' content isn't split into routes).`);

  const primaryOp = OPERATIONS[exp.primaryOperation];
  const primaryCta: EngineActionSpec = {
    intent: primaryOp.actionIntent && SAFE_INTENTS.has(primaryOp.actionIntent) ? primaryOp.actionIntent : 'engine.enquiry',
    label: exp.primaryCta, kind: ['appointment', 'booking', 'site_visit'].includes(exp.primaryOperation) ? 'booking' : 'enquiry',
  };

  const cssVars: Record<string, string> = { '--primary': theme.accent, '--accent': theme.accent2, '--radius': theme.radius };

  return {
    cssVars,
    layout: {
      theme,
      brandDefaults: { name: '', tagline: '', about: '' },
      choices: [], choiceLabel: 'Option',
      nav: [{ href: '#catalog', label: 'Offerings' }, { href: '#enquiry', label: 'Contact' }],
      bottomNav: [
        { label: 'Home', icon: 'Home', href: '#top' },
        { label: 'Browse', icon: 'Grid', href: '#catalog' },
        { label: exp.primaryCta, icon: 'Calendar', href: '#enquiry', emphasis: true },
      ],
      primaryCta,
      sections,
    },
    detected,
    notes,
  };
}
