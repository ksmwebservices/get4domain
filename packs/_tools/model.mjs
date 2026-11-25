// Turns a pack's content.json into the renderer's content model, for the preview pages and screenshots only.
// It starts from the kit's sample content for the pack's first category (so every key exists) and overrides what content.json defines.
// Wording variant 0 is used. Placeholders are filled with clearly fictional demo values; testimonials and reviews are left empty.
import { sampleContent } from '../../themes/fixtures/index.mjs';

export const DEMO = {
  vendor_name: 'Sample Company', owner: 'Sample Owner', town: 'Salem', area: 'Fairlands', branches: 'Attur and Omalur', phone: '+91 00000 00000',
  rera_no: 'to be added by the vendor', approvals: 'to be added by the vendor',
};

const inr = (n) => {
  const s = String(Math.round(n));
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${last3}`;
};

export function fill(s, demo = DEMO) { return String(s ?? '').replace(/\[\[(\w+)\]\]/g, (_, k) => demo[k] ?? `[${k}]`); }
const first = (v, demo) => fill(Array.isArray(v) ? v[0] : v, demo);

export function priceText(p) {
  if (!p) return '';
  return `From ₹${inr(p.amount)} ${p.unit}`;
}

export function contentToModel(pack, { lang = 'en', demo = DEMO, listSlug = 'portfolio', variant = 0 } = {}) {
  const c = sampleContent(pack.kitCategories[0], { lang });
  const pick = (v) => fill(Array.isArray(v) ? v[variant % v.length] : v, demo);
  c.sample = false; c.sampleNote = '';
  c.site = { ...c.site, name: demo.vendor_name, tagline: pick(pack.hero.bannerText), logo: '', logoAlt: `${demo.vendor_name} logo`, registrationNo: demo.rera_no, established: '', url: 'https://sample-company.get4domain.com' };
  c.hero = { ...c.hero, title: pick(pack.hero.title), subtitle: pick(pack.hero.subtitle), image: '', imageAlt: '', badge: '' };
  c.about = { ...c.about, title: fill(pack.about.title, demo), text: pick(pack.about.text), image: '', imageAlt: '' };
  c.cta = { ...c.cta, label: pack.cta.label, secondaryLabel: pack.cta.secondary, secondaryHref: `/${listSlug}` };
  c.contact = { ...c.contact, city: demo.town, area: demo.area, address: `12, Main Road, ${demo.area}, ${demo.town}`, phone: demo.phone };
  const groupName = Object.fromEntries(pack.groups.map((g) => [g.slug, g.name]));
  const detail = (it, label) => fill(it.details.find((d) => d.label === label)?.value ?? '', demo);
  c.items = pack.items.map((it, i) => ({
    id: it.slug, slug: it.slug, name: fill(it.name, demo), description: pick(it.description), price: priceText(it.priceFrom), image: `sample:item-${i + 1}`, href: `/${listSlug}/${it.slug}`,
    badge: it.badge ?? '', category: detail(it, 'Project type') || detail(it, 'Type') || groupName[it.group], duration: detail(it, 'Possession') || detail(it, 'Timeline'), tags: '', includes: it.highlights.join(' · '),
    location: detail(it, 'Location'), area: detail(it, 'Sizes') || detail(it, 'Size'), bedrooms: detail(it, 'Configurations') || detail(it, 'Configuration'), veg: '',
  }));
  c.groups = pack.groups.map((g) => { const items = c.items.filter((_, i) => pack.items[i].group === g.slug); return { name: g.name, slug: g.slug, count: items.length, items }; });
  c.team = (pack.team ?? []).map((m, i) => ({ id: `t${i + 1}`, name: fill(m.name, demo), role: m.role, note: fill(m.note ?? '', demo), image: '' }));
  c.credentials = (pack.credentials ?? []).map((x) => ({ title: x.title, detail: fill(x.detail, demo) }));
  c.faqs = pack.faqs.map((f) => ({ q: fill(f.q, demo), a: pick(f.a) }));
  c.trust = pack.trust.map((text) => ({ text }));
  c.steps = pack.steps.map((s, i) => ({ n: i + 1, title: s.title, desc: s.desc }));
  c.areas = pack.areas.map((a) => ({ name: fill(a, demo) }));
  c.blocks = pack.blocks.map((b) => ({ key: b.key, title: b.title, items: b.items.map((e) => ({ title: fill(e.title, demo), detail: fill(e.detail, demo), price: e.price })) }));
  c.testimonials = []; c.stats = []; c.offers = []; c.videos = [];
  c.reviews = { sample: false, summary: { rating: 0, count: 0 }, writeUrl: '', google: [] };
  c.terms = { ...c.terms, items: pack.terms?.items ?? 'Projects', itemOne: pack.terms?.itemOne ?? 'Project', groups: pack.terms?.groups ?? 'Project status' };
  c.page = { ...c.page, title: pack.listPageTitle ?? 'Projects', intro: pick(pack.hero.subtitle) };
  return c;
}
