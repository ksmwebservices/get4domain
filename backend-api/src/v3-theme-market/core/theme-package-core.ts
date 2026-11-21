import { CATALOGUE_CATEGORIES } from '../../directory/core/catalogue-categories';
import { KIT_ONLY_PACK, PACK_KIT_FALLBACK } from '../../directory/core/listable-categories';
import type { Kit, KitManifest } from '../../site-publish/renderer/renderer-loader';

/**
 * Theme package specification v1, the backend half (docs/v3/THEME_PACKAGE_SPEC.md). PURE: no database, no Nest, no clock, no network.
 *
 * A theme package is the theme kit's own zip (theme.json, templates/, css/, presets/, assets/). The KIT checks the file layout and the manifest SHAPE (themes/lib/pack.mjs validatePackage, themes/lib/lint.mjs);
 * this file adds what only the platform knows: which packs, add-ons, capabilities, combination tags and catalogue categories are real, whether the package is content-free, and that a custom theme names
 * the vendor it was made for. Every problem comes back as { file, rule, message } so an admin can fix all of them in one go; nothing here throws.
 */

export const PACK_KEYS: readonly string[] = ['PROPERTY', 'CLINIC', 'LAB', 'PHARMACY', 'RETAIL', 'FOOD_SERVICE', 'FIELD_SERVICE', 'VEHICLE_SERVICE', 'LOGISTICS', 'MEMBERSHIP_WELLNESS', 'EDUCATION', 'PRACTICE_LEGAL_FINANCE', 'AGENCY_CONSULTING', 'HOSPITALITY_EVENTS', 'RENTAL_FLEET', 'B2B_DEALER'];
export const ADDON_KEYS: readonly string[] = ['SHOP', 'ONLINE_ORDERING_DELIVERY', 'PHARMACY_COUNTER', 'HOME_SAMPLE_COLLECTION'];
export const CAPABILITY_KEYS: readonly string[] = ['SERVICES', 'APPOINTMENTS', 'MEMBERSHIPS', 'LISTINGS', 'BROKERAGE', 'RENTALS', 'MADE_TO_ORDER', 'DISPATCH', 'DELIVERY', 'PHARMACY', 'LAB', 'FOOD_SERVICE', 'VEHICLE_RENTAL', 'STORE'];

/** The service packs a "service plus shop" style tag may sit on. */
const SERVICE_PACKS: readonly string[] = ['FIELD_SERVICE', 'VEHICLE_SERVICE', 'LOGISTICS', 'PRACTICE_LEGAL_FINANCE', 'AGENCY_CONSULTING', 'MEMBERSHIP_WELLNESS', 'EDUCATION', 'HOSPITALITY_EVENTS', 'RENTAL_FLEET', 'CLINIC', 'LAB'];

/**
 * The combination tags a theme may carry. DATA, not branches: add a row to offer a new combination. A tag is only coherent when the theme is designed for one of `packsAny`, names every add-on in
 * `addons` and every capability in `capabilities`; so "clinic with pharmacy, lab and home sample" cannot be claimed by a theme that never says it draws those counters.
 */
export interface CombinationTag { label: string; packsAny: readonly string[]; addons: readonly string[]; capabilities: readonly string[] }
export const COMBINATION_TAGS: Readonly<Record<string, CombinationTag>> = {
  'service-plus-shop': { label: 'Service business with a shop', packsAny: SERVICE_PACKS, addons: ['SHOP'], capabilities: [] },
  'handyman-plus-shop': { label: 'Handyman or home service with a shop', packsAny: ['FIELD_SERVICE'], addons: ['SHOP'], capabilities: [] },
  'vehicle-service-plus-shop': { label: 'Vehicle service with a parts shop', packsAny: ['VEHICLE_SERVICE'], addons: ['SHOP'], capabilities: [] },
  'cloud-kitchen-plus-delivery': { label: 'Cloud kitchen with delivery', packsAny: ['FOOD_SERVICE'], addons: ['ONLINE_ORDERING_DELIVERY'], capabilities: [] },
  'restaurant-plus-delivery': { label: 'Restaurant with online ordering and delivery', packsAny: ['FOOD_SERVICE', 'HOSPITALITY_EVENTS'], addons: ['ONLINE_ORDERING_DELIVERY'], capabilities: [] },
  'shop-plus-delivery': { label: 'Shop with online ordering and delivery', packsAny: ['RETAIL', 'PHARMACY', 'B2B_DEALER'], addons: ['ONLINE_ORDERING_DELIVERY'], capabilities: [] },
  'clinic-plus-pharmacy': { label: 'Clinic with a pharmacy counter', packsAny: ['CLINIC'], addons: ['PHARMACY_COUNTER'], capabilities: [] },
  'clinic-plus-lab': { label: 'Clinic with a lab counter', packsAny: ['CLINIC'], addons: [], capabilities: ['LAB'] },
  'clinic-pharmacy-lab-home-sample': { label: 'Clinic with a pharmacy counter, a lab counter and home sample collection', packsAny: ['CLINIC'], addons: ['PHARMACY_COUNTER', 'HOME_SAMPLE_COLLECTION'], capabilities: ['LAB'] },
  'lab-plus-home-sample': { label: 'Lab with home sample collection', packsAny: ['LAB'], addons: ['HOME_SAMPLE_COLLECTION'], capabilities: [] },
  'pharmacy-plus-delivery': { label: 'Pharmacy with delivery', packsAny: ['PHARMACY'], addons: ['ONLINE_ORDERING_DELIVERY'], capabilities: [] },
  'wellness-plus-shop': { label: 'Wellness or salon with a shop', packsAny: ['MEMBERSHIP_WELLNESS'], addons: ['SHOP'], capabilities: [] },
  'education-plus-shop': { label: 'Education with a book or material shop', packsAny: ['EDUCATION'], addons: ['SHOP'], capabilities: [] },
  'hospitality-plus-shop': { label: 'Hospitality or events with a shop', packsAny: ['HOSPITALITY_EVENTS'], addons: ['SHOP'], capabilities: [] },
};

/** One thing wrong with a package. `file` is the path inside the package ('' for the package as a whole); `rule` is a stable name (the kit's rule or `marketplace-...`); never contains customer data. */
export interface PackageProblem { file: string; rule: string; message: string; source: 'package' | 'lint' | 'marketplace' | 'content' }
export interface PackageContext {
  /** the vendor a PRIVATE custom theme is for (the upload route's own value); null for a marketplace theme */
  vendorId: string | null;
  /** extra words that must not appear anywhere (M4: the vendor's name, domain, phone, e-mail) */
  forbiddenText?: ReadonlyArray<{ label: string; value: string }>;
  /** sha256 hex of the vendor's own media files (M4): an asset with one of these hashes is refused */
  forbiddenAssetHashes?: ReadonlySet<string>;
  /** skip the (slow) lint, for callers that already ran it */
  skipLint?: boolean;
}
export interface PackageReport { ok: boolean; problems: PackageProblem[]; manifest: KitManifest | null; files: Record<string, Buffer>; contentHash: string | null }

const CATALOGUE_BY_ID = new Map(CATALOGUE_CATEGORIES.map((c) => [c.id, c.pack] as const));
const packOfCatalogueId = (id: string): string | null => CATALOGUE_BY_ID.get(id) ?? KIT_ONLY_PACK[id] ?? null;
const P = (file: string, rule: string, message: string, source: PackageProblem['source'] = 'marketplace'): PackageProblem => ({ file, rule, message, source });
const dup = <T>(xs: readonly T[] | undefined): T[] => { const seen = new Set<T>(); const out: T[] = []; for (const x of xs ?? []) { if (seen.has(x) && !out.includes(x)) out.push(x); seen.add(x); } return out; };

/** The marketplace rules for a manifest whose SHAPE the kit already accepted. */
export function marketplaceProblems(manifest: KitManifest, files: Readonly<Record<string, Buffer>>, ctx: Pick<PackageContext, 'vendorId'>, kit?: Pick<Kit, 'categoryById' | 'hasCategory'>): PackageProblem[] {
  const out: PackageProblem[] = []; const mk = manifest.marketplace; const F = 'theme.json';
  if (!mk) return [P(F, 'marketplace-required', 'theme.json needs a "marketplace" block (packs and licence) to be uploaded to the marketplace.')];
  for (const p of mk.packs) if (!PACK_KEYS.includes(p)) out.push(P(F, 'marketplace-pack-unknown', `marketplace.packs: ${p} is not one of the ${PACK_KEYS.length} industry packs.`));
  for (const a of mk.addons ?? []) if (!ADDON_KEYS.includes(a)) out.push(P(F, 'marketplace-addon-unknown', `marketplace.addons: ${a} is not an add-on pack (${ADDON_KEYS.join(', ')}).`));
  for (const c of mk.capabilities ?? []) if (!CAPABILITY_KEYS.includes(c)) out.push(P(F, 'marketplace-capability-unknown', `marketplace.capabilities: ${c} is not a capability.`));
  if (!mk.licence) out.push(P(F, 'marketplace-licence-missing', 'marketplace.licence needs a short plain note on who may use the theme.'));
  for (const t of mk.tags ?? []) {
    const tag = COMBINATION_TAGS[t];
    if (!tag) { out.push(P(F, 'marketplace-tag-unknown', `marketplace.tags: ${t} is not a known combination tag.`)); continue; }
    if (!tag.packsAny.some((p) => mk.packs.includes(p))) out.push(P(F, 'marketplace-tag-incoherent', `marketplace.tags: ${t} needs the theme to be designed for one of: ${tag.packsAny.join(', ')}.`));
    for (const a of tag.addons) if (!(mk.addons ?? []).includes(a)) out.push(P(F, 'marketplace-tag-incoherent', `marketplace.tags: ${t} needs marketplace.addons to list ${a}.`));
    for (const c of tag.capabilities) if (!(mk.capabilities ?? []).includes(c)) out.push(P(F, 'marketplace-tag-incoherent', `marketplace.tags: ${t} needs marketplace.capabilities to list ${c}.`));
  }
  for (const id of mk.catalogueCategories ?? []) {
    const pack = packOfCatalogueId(id);
    if (!pack) out.push(P(F, 'marketplace-category-unknown', `marketplace.catalogueCategories: ${id} is not in the 196-category catalogue.`));
    else if (!mk.packs.includes(pack)) out.push(P(F, 'marketplace-category-pack', `marketplace.catalogueCategories: ${id} belongs to the ${pack} pack, which the theme does not list in marketplace.packs.`));
  }
  // a theme is offered to a pack through its track: the kit category the pack's site is drawn from must be on a track the theme declares
  if (kit) for (const p of mk.packs) {
    const fb = PACK_KIT_FALLBACK[p];
    if (fb && kit.hasCategory(fb) && !manifest.tracks.includes(kit.categoryById(fb).track)) out.push(P(F, 'marketplace-pack-track', `marketplace.packs: ${p} is drawn on the ${kit.categoryById(fb).track} track, which the theme does not declare in "tracks".`));
  }
  for (const [i, pv] of (mk.previews ?? []).entries()) if (!(pv.path in files)) out.push(P(pv.path, 'marketplace-preview-missing', `marketplace.previews[${i}]: ${pv.path} is not in the package.`));
  for (const x of dup(mk.previews?.map((p) => p.path))) out.push(P(x, 'marketplace-preview-duplicate', `marketplace.previews: ${x} is listed twice.`));
  if (mk.sourceVendorId != null && mk.sourceVendorId !== ctx.vendorId) out.push(P(F, 'marketplace-source-vendor', ctx.vendorId ? 'marketplace.sourceVendorId names a different business than the one this package is uploaded for.' : 'marketplace.sourceVendorId must be empty for a theme uploaded to the marketplace; the upload sets it for a private theme.'));
  if (manifest.internal === true) out.push(P(F, 'marketplace-internal', 'A package cannot be marked internal.'));
  return out;
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/;
const PHONE = /(?<![\w.#%-])(?:\+?\d{1,3}[\s-]?)?(?:\d[\s-]?){9,12}\d(?![\w%])/;
const URLISH = /\b(?:https?:\/\/|www\.)[^\s"'<>)]+/i;
/** Hosts a template may name (the kit's map and video embed hosts): everything else is an outside address. */
const ALLOWED_HOSTS = ['www.google.com', 'maps.google.com', 'www.openstreetmap.org', 'www.youtube.com', 'www.youtube-nocookie.com', 'youtu.be', 'player.vimeo.com', 'vimeo.com'];
const hostOf = (u: string): string => { try { return new URL(u.startsWith('www.') ? `https://${u}` : u).hostname.toLowerCase(); } catch { return ''; } };

/** A package is content-free: no contact detail, no outside address, no named business. Only the text files are read; pictures are checked by hash (M4). */
export function contentProblems(files: Readonly<Record<string, Buffer>>, ctx: Pick<PackageContext, 'forbiddenText' | 'forbiddenAssetHashes'>, sha256?: (b: Buffer) => string): PackageProblem[] {
  const out: PackageProblem[] = [];
  for (const [path, data] of Object.entries(files)) {
    const isText = /\.(html|css|json)$/.test(path);
    if (isText) {
      const text = data.toString('utf8');
      // the kit's own placeholders ({{contact.phone}}) are fine; a literal one is not. CSS and JSON numbers are not phone numbers, so only html and the manifest are read for them.
      const body = text.replace(/\{\{[^}]*\}\}/g, '');
      if (/\.(html|json)$/.test(path)) {
        if (EMAIL.test(body)) out.push(P(path, 'content-email', 'contains an e-mail address; a theme is content-free (use {{contact.email}}).', 'content'));
        if (PHONE.test(body.replace(/"(?:contentHash|sha256)"\s*:\s*"[0-9a-f]+"/g, ''))) out.push(P(path, 'content-phone', 'contains a phone number; a theme is content-free (use {{contact.phone}}).', 'content'));
      }
      for (const m of body.matchAll(new RegExp(URLISH, 'gi'))) {
        const h = hostOf(m[0]);
        if (!ALLOWED_HOSTS.includes(h) && !/schema\.org$|w3\.org$|get4domain\.com$/.test(h)) { out.push(P(path, 'content-outside-address', `names an outside address (${h || 'unreadable'}); only the platform's own addresses and the map and video hosts are allowed.`, 'content')); break; }
      }
      for (const f of ctx.forbiddenText ?? []) {
        if (f.label === 'phone') {   // a phone number is found whatever its spacing: compare the last ten digits with spaces, hyphens, brackets and plus signs removed (html and the manifest only: a stylesheet has numbers, not phones)
          const digits = f.value.replace(/[^0-9]/g, '').slice(-10);
          if (digits.length >= 7 && /[.](html|json)$/.test(path) && body.replace(/[ \t\r\n().+-]/g, '').includes(digits)) out.push(P(path, 'content-vendor-detail', "contains the business's phone number; a theme that is published must be content-free.", 'content'));
        } else if (f.value.length >= 3 && text.toLowerCase().includes(f.value.toLowerCase())) out.push(P(path, 'content-vendor-detail', `contains the business's ${f.label}; a theme that is published must be content-free.`, 'content'));
      }
    }
    if (ctx.forbiddenAssetHashes && sha256 && path.startsWith('assets/') && ctx.forbiddenAssetHashes.has(sha256(data))) out.push(P(path, 'content-vendor-media', 'is a file from the business\'s own media; a theme that is published must be content-free.', 'content'));
  }
  return out;
}

/** Turns the kit's own rule list into problems. A kit file path may carry a suffix ("theme.json:marketplace.packs"): the file is the part before the colon, the rest stays in the message. */
export function kitProblems(errors: ReadonlyArray<{ code: string; path: string; message: string }>): PackageProblem[] {
  return errors.map((e) => { const i = e.path.indexOf(':'); return P(i < 0 ? e.path : e.path.slice(0, i), e.code, i < 0 ? e.message : `${e.path.slice(i + 1)}: ${e.message}`, 'package'); });
}
export function lintProblems(findings: ReadonlyArray<{ rule: string; message?: string; where?: string }>): PackageProblem[] {
  return findings.slice(0, 100).map((f) => P(f.where?.split(':')[0] ?? '', f.rule, f.message ?? f.rule, 'lint'));
}

/**
 * Everything a package must pass, in the order a person would fix it: the zip (kit), the marketplace rules, the content-free rules, then the kit's lint (rendering every template). The first group
 * that fails still lets the later cheap groups run, but lint only runs on a package that is otherwise sound (it renders the templates, which a broken package cannot do).
 */
export function inspectPackage(kit: Pick<Kit, 'validatePackage' | 'themeFromFiles' | 'lintTheme' | 'categoryById' | 'hasCategory'>, zip: Buffer, ctx: PackageContext, sha256?: (b: Buffer) => string): PackageReport {
  const r = kit.validatePackage(zip);
  const problems: PackageProblem[] = kitProblems(r.errors);
  if (r.manifest) problems.push(...marketplaceProblems(r.manifest, r.files, ctx, kit));
  problems.push(...contentProblems(r.files, ctx, sha256));
  if (problems.length === 0 && r.manifest && !ctx.skipLint) {
    try { problems.push(...lintProblems(kit.lintTheme(kit.themeFromFiles(r.files), {}).findings)); }
    catch (e) { problems.push(P('', 'lint-crashed', `the theme could not be rendered for the check: ${e instanceof Error ? e.message.slice(0, 200) : 'unknown error'}`, 'lint')); }
  }
  const manifest = r.manifest;
  return { ok: problems.length === 0, problems, manifest, files: r.files, contentHash: manifest && typeof (manifest as unknown as { contentHash?: string }).contentHash === 'string' ? (manifest as unknown as { contentHash: string }).contentHash : null };
}
