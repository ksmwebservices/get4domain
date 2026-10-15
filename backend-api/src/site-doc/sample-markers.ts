import { SITE_EXTRAS_LISTS, SITE_EXTRAS_TEXT, SiteExtras, SiteTestimonial } from './site-doc.constants';

/**
 * Sample content rules (industry designs, 15 Oct 2026). Starter text is copied into the vendor's own site marked "sample". A field stops being sample the moment the vendor
 * changes it. Sample prices and sample customer quotes never reach the public page. Pure functions: used by the editor service, the product service and the public API.
 */
const diff = (a: unknown, b: unknown): boolean => JSON.stringify(a ?? null) !== JSON.stringify(b ?? null);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** Marks of a site's starter fields; true = still the starter text. */
export const sampleMap = (extras: unknown): Record<string, boolean> => ({ ...((obj(extras).sample as Record<string, boolean> | undefined) ?? {}) });

/**
 * Takes the draft patch an editor sent and the site as it is now. Fields the vendor changed lose their sample mark; the server, not the browser, decides the marks.
 * Returns the patch to store.
 */
export function applyEditMarkers(current: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...patch };
  const curEx = obj(current.extras) as SiteExtras;
  const sample = sampleMap(curEx);
  let touched = false;
  const clear = (k: string): void => { if (sample[k]) { sample[k] = false; touched = true; } };

  for (const k of ['tagline', 'about', 'banner'] as const) if (k in patch && diff(patch[k] ?? '', current[k] ?? '')) clear(k);
  if ('portfolio' in patch && diff(patch.portfolio, current.portfolio)) clear('gallery');
  const ex = 'extras' in patch ? (obj(patch.extras) as SiteExtras) : null;
  if (ex) for (const k of [...SITE_EXTRAS_TEXT, ...SITE_EXTRAS_LISTS]) if (k in ex && diff((ex as Record<string, unknown>)[k], (curEx as Record<string, unknown>)[k])) clear(k);

  if ('testimonials' in patch && Array.isArray(patch.testimonials)) {
    const cur = (Array.isArray(current.testimonials) ? current.testimonials : []) as SiteTestimonial[];
    out.testimonials = (patch.testimonials as SiteTestimonial[]).map((t) => {
      const { sample: _s, ...rest } = t; void _s;
      const was = cur.find((c) => c.sample && c.quote === t.quote && c.author === t.author);
      return was ? { ...rest, sample: true } : rest;
    });
  }
  if (ex) out.extras = { ...ex, sample: touched || Object.keys(sample).length ? sample : undefined };
  else if (touched) out.extras = { ...curEx, sample };
  return out;
}

/** The custom fields of a starter item the vendor edited: the item stops being sample, and a changed price stops being a sample price. */
export function itemMarkersAfterEdit(
  existing: Record<string, unknown> | null | undefined,
  next: Record<string, unknown> | null | undefined,
  edited: { content: boolean; price: boolean },
): Record<string, unknown> | undefined {
  const was = obj(existing);
  const isSample = was.sample === 'true';
  const hadSamplePrice = was.samplePrice === 'true';
  if (!isSample && !hadSamplePrice) return next ?? undefined;
  const base: Record<string, unknown> = { ...(next ?? was) };
  delete base.sample; delete base.samplePrice;
  if (isSample && !edited.content) base.sample = 'true';
  if (hadSamplePrice && !edited.price) base.samplePrice = 'true';
  return base;
}

export const isSampleItem = (cf: unknown): boolean => obj(cf).sample === 'true';
export const hasSamplePrice = (cf: unknown): boolean => obj(cf).samplePrice === 'true';

/** Customer quotes the public may see: the sample ones are hidden until the vendor edits them. */
export const publicQuotes = (list: unknown): SiteTestimonial[] => (Array.isArray(list) ? (list as SiteTestimonial[]).filter((t) => t && !t.sample) : []);

/**
 * Does the site carry real content the vendor wrote or added? A site with only starter text is not offered to search engines.
 * Real = the About text was edited, or at least one item is not a starter item, or at least one customer quote is the vendor's own.
 */
export function hasRealContent(doc: { about?: unknown; testimonials?: unknown; extras?: unknown }, items: { customFields?: unknown }[]): boolean {
  const sample = sampleMap(doc.extras);
  const aboutReal = typeof doc.about === 'string' && doc.about.trim().length > 0 && !sample.about;
  const itemReal = items.some((i) => !isSampleItem(i.customFields));
  const quoteReal = publicQuotes(doc.testimonials).length > 0;
  return aboutReal || itemReal || quoteReal;
}
