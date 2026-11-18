import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { renderToStaticMarkup } from 'react-dom/server';
import { PoweredBy, PoweredByBar, POWERED_BY_BRAND, POWERED_BY_HREF } from '../../../get4domain_mvp/src/engine/components/PoweredBy';
import ShellFooter from '../../../get4domain_mvp/src/engine/shell/ShellFooter';
import { DesignFooter } from '../../../get4domain_mvp/src/engine/kit/design-sections';
import KitRenderer from '../../../get4domain_mvp/src/engine/kit/KitRenderer';
import { ReFooter } from '../../../get4domain_mvp/src/engine/industries/real-estate/sections/blocks';
import RetailSite from '../../../get4domain_mvp/src/engine/industries/retail/RetailSite';
import { RawThemeFrame } from '../../../get4domain_mvp/src/engine/raw-theme-frame';

/**
 * D2: "Powered by Get4Domain" on every vendor site. Each footer is rendered to HTML and must carry the SAME mark: the words, the link text (the brand name only) and the address
 * https://get4domain.com. No plan flag or vendor setting is an input of any footer, so none can remove it (the last block proves the inputs a footer takes).
 */
const WEB = join(__dirname, '..', '..', '..', 'get4domain_mvp', 'src');

/** the mark as it must appear: exactly one anchor, its text the brand name alone, pointing at the brand site */
function expectMark(html: string, times = 1): void {
  const marks = html.match(/<span[^>]*data-g4d-powered-by[^>]*>[\s\S]*?<\/span>/g) ?? [];
  expect(marks).toHaveLength(times);
  for (const m of marks) {
    expect(m.replace(/<[^>]+>/g, '')).toBe('Powered by Get4Domain');
    const anchors = m.match(/<a [^>]*>[^<]*<\/a>/g) ?? [];
    expect(anchors).toHaveLength(1);
    expect(anchors[0]).toContain(`href="${POWERED_BY_HREF}"`); expect(anchors[0].replace(/<[^>]+>/g, '')).toBe('Get4Domain');
    expect(anchors[0]).toContain('rel="noopener"');
  }
}

const brand = { name: 'Sri Ganesh Plumbing', tagline: 'Fast and tidy', about: 'About us', phone: '+919876543210', email: 'a@b.com', address: '12 Usman Road, Chennai' };
const runtime = {
  subdomain: 'sri-ganesh', mode: 'live', base: '/site/sri-ganesh', family: 'home-services', goal: 'enquiry', business: { name: 'Sri Ganesh Plumbing', phone: '+919876543210', email: 'a@b.com', address: '12 Usman Road' },
  popup: { title: 't', steps: [], confirm: 'c', email: 'hidden', message: 'hidden' }, items: [], team: [], bottomNav: [], more: [{ label: 'Home', href: '/' }], social: {}, hours: [{ label: 'Mon-Sat', value: '9-6' }],
  legal: [{ label: 'Privacy', href: '/legal/privacy' }], cart: { enabled: false }, primaryLabel: 'Book', flowPath: '/flow',
} as never;
const kitModel = (over: Record<string, unknown> = {}) => ({
  brand, theme: {}, choices: [], choiceLabel: 'Service', nav: [{ href: '#a', label: 'A' }], bottomNav: [], primaryCta: { label: 'Book now', href: '#enquiry' }, sections: [], ...over,
}) as never;

describe('the shared mark', () => {
  it('prints "Powered by Get4Domain" with the brand name alone as the link text, pointing at https://get4domain.com', () => {
    const html = renderToStaticMarkup(<PoweredBy />);
    expectMark(html); expect(POWERED_BY_HREF).toBe('https://get4domain.com'); expect(POWERED_BY_BRAND).toBe('Get4Domain');
  });
  it('takes a class name and nothing else: a plan flag, a vendor setting or a "hide" prop has no effect', () => {
    const html = renderToStaticMarkup(<PoweredBy {...({ className: 'x', hidden: true, hide: true, show: false, plan: 'PRO', whiteLabel: true, vendorSettings: { hidePoweredBy: true } } as object)} />);
    expectMark(html); expect(html).toContain('class="x"');
  });
  it('the bar (for a page in its own frame) carries the same mark in a bar of fixed height', () => {
    const html = renderToStaticMarkup(<PoweredByBar />);
    expectMark(html); expect(html).toContain('data-g4d-powered-by-bar'); expect(html).toContain('height:2.25rem');
  });
});

describe('each footer carries the mark', () => {
  it('ShellFooter: columns, centered and minimal (the minimal one had none before)', () => {
    for (const variant of ['columns', 'centered', 'minimal'] as const) {
      const html = renderToStaticMarkup(<ShellFooter runtime={runtime} variant={variant} tagline="t" links={[{ label: 'Home', href: '/' }]} />);
      expect(html).toContain(`data-g4d-footer="${variant}"`); expectMark(html);
    }
  });
  it('design-sections DesignFooter: minimal and centered', () => {
    for (const variant of ['minimal', 'centered'] as const) expectMark(renderToStaticMarkup(<DesignFooter variant={variant} brand={brand as never} cta="Book now" />));
  });
  it('KitRenderer: the default kit footer, and the designed footers (centered, minimal)', () => {
    const live = { kind: 'live', subdomain: 'sri-ganesh' } as never;
    expectMark(renderToStaticMarkup(<KitRenderer model={kitModel()} mode={live} />));
    for (const footer of ['centered', 'minimal']) {
      const html = renderToStaticMarkup(<KitRenderer model={kitModel({ style: { footer, button: 'solid', nav: 'bar', actionBar: 'tabs' } })} mode={live} />);
      expect(html).toContain('<footer'); expectMark(html);
    }
  });
  it('the retail footer', () => {
    const site = { vendor: { id: 'v1', businessName: 'Aura Jewellers', subdomain: 'aura' }, cms: { businessName: 'Aura Jewellers' }, products: [], paymentsEnabled: false } as never;
    expectMark(renderToStaticMarkup(<RetailSite site={site} mode={{ kind: 'live', subdomain: 'aura' } as never} />));
  });
  it('the real-estate footer', () => {
    expectMark(renderToStaticMarkup(<ReFooter model={{ brand, sections: [] } as never} />));
  });
  it('an uploaded theme (its own document in a frame) gets the mark in a bar under the frame, and the frame gives up exactly the bar height', () => {
    const html = renderToStaticMarkup(<RawThemeFrame srcDoc="<html></html>" title="t" />);
    expect(html).toContain('<iframe'); expectMark(html); expect(html).toContain('height:calc(100vh - 2.25rem)');
  });
});

/** every file under the vendor-site code (the engine, the site route, the campaign page) */
const walk = (dir: string, out: string[] = []): string[] => { for (const n of readdirSync(dir)) { const p = join(dir, n); if (statSync(p).isDirectory()) walk(p, out); else if (/\.tsx?$/.test(n)) out.push(p); } return out; };
const SITE_CODE = [...walk(join(WEB, 'engine')), ...walk(join(WEB, 'app', 'site')), ...walk(join(WEB, 'app', 'go'))];
const src = (f: string): string => readFileSync(f, 'utf8');
const rel = (f: string): string => relative(WEB, f).replace(/\\/g, '/');

describe('the contract in the source', () => {
  it('no vendor-site file types the words itself: only PoweredBy.tsx does (so the text, the link and the address cannot drift)', () => {
    const typed = SITE_CODE.filter((f) => /powered by/i.test(src(f)) && !f.endsWith(join('components', 'PoweredBy.tsx')));
    // comments may talk about it; markup may not: a line with the words that is not a comment
    const offenders = typed.flatMap((f) => src(f).split('\n').map((l, i) => ({ f, l, i })).filter(({ l }) => /powered by/i.test(l) && !/^\s*(\/\/|\*|\/\*)/.test(l) && !/\{\/\*/.test(l)).map(({ f: file, i }) => `${rel(file)}:${i + 1}`));
    expect(offenders).toEqual([]);
  });
  it('every footer file renders the shared component', () => {
    for (const f of ['engine/shell/ShellFooter.tsx', 'engine/kit/design-sections.tsx', 'engine/kit/KitRenderer.tsx', 'engine/industries/retail/RetailSite.tsx', 'engine/industries/real-estate/sections/blocks.tsx', 'app/site/[subdomain]/[[...rest]]/page.tsx', 'app/go/[slug]/LegacyCampaignPage.tsx', 'engine/raw-theme-frame.tsx']) {
      const text = src(join(WEB, f));
      expect(text).toMatch(/import \{[^}]*PoweredBy[^}]*\} from '[^']*components\/PoweredBy'/); expect(text).toMatch(/<PoweredBy(Bar)?[ />]/);
    }
    // the ShellFooter prints it in all three layouts, the design footers in both of theirs
    expect(src(join(WEB, 'engine/shell/ShellFooter.tsx')).match(/<PoweredBy /g)).toHaveLength(3);
    expect(src(join(WEB, 'engine/kit/design-sections.tsx')).match(/<PoweredBy /g)).toHaveLength(2);
  });
  it('the legacy site page no longer links to "/" (which on a vendor host is the vendor\'s own site)', () => {
    const page = src(join(WEB, 'app/site/[subdomain]/[[...rest]]/page.tsx'));
    expect(page).not.toMatch(/Powered by[\s\S]{0,80}href="\/"/); expect(page).toContain('<PoweredBy />');
  });
  it('the component has no plan, vendor, theme or setting input: its only prop is className', () => {
    const text = src(join(WEB, 'engine/components/PoweredBy.tsx'));
    expect(text).toContain('export function PoweredBy({ className }: { className?: string })');
    expect(text.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/\b(plan|entitlement|setting|hide|whiteLabel|branding)\b/i);
  });
  it('the published-site renderer (themes/lib/render.mjs) writes the same words, link text and address', () => {
    const render = readFileSync(join(__dirname, '..', '..', '..', 'themes', 'lib', 'render.mjs'), 'utf8');
    expect(render).toContain(`export const POWERED_BY_HREF = '${POWERED_BY_HREF}'`); expect(render).toContain(`export const POWERED_BY_BRAND = '${POWERED_BY_BRAND}'`);
    expect(render).toContain('Powered by <a href="${POWERED_BY_HREF}" target="_blank" rel="noopener">${POWERED_BY_BRAND}</a>');
  });
});
