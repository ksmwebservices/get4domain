'use strict';
/**
 * B6.3: the pure parts of the vendor diagnosis. READ ONLY by construction: `collect` calls only find/count methods, and `render` turns the facts into plain lines.
 * Nothing here prints a phone number or an e-mail address; the vendor is named by id.
 */

/** Which way the vendor was named: `--email x` or `--id x`, and only one of them. Returns { ok, by, value, staging } or { ok: false, problem }. */
function parseArgs(argv) {
  let by = null; let value = null; let staging = false;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--staging') { staging = true; continue; }
    if (a === '--email' || a === '--id') {
      if (by) return { ok: false, problem: 'name the vendor once: either --email or --id' };
      by = a.slice(2); value = argv[i + 1]; i += 1;
      if (!value || value.startsWith('--')) return { ok: false, problem: `${a} needs a value` };
      continue;
    }
    return { ok: false, problem: `unknown argument ${a.startsWith('--') ? a : '(a bare value; use --email or --id)'}` };
  }
  if (!by) return { ok: false, problem: 'give --email <address> or --id <vendor id>' };
  return { ok: true, by, value: value.trim(), staging };
}

const yn = (b) => (b ? 'yes' : 'no');
const rupees = (paise) => `Rs ${(paise / 100).toFixed(2)}`;

/**
 * Reads the facts through an injected Prisma client and the compiled helpers (`shapePlanOptions`, `categoryProbe`, `baseDomain`). Returns null when no vendor matches.
 * `categoryProbe(industry, track)` says which kit category the build would use ('own', 'track-default' or 'none') or null when the kit cannot be loaded here.
 */
async function collect(prisma, ident, deps, now = new Date()) {
  const where = ident.by === 'id' ? { id: ident.value } : { email: { equals: ident.value, mode: 'insensitive' } };
  const v = await prisma.vendor.findFirst({ where, select: { id: true, status: true, role: true, createdAt: true, industry: true, subdomain: true, siteProvisionStatus: true, siteProvisionCode: true, siteProvisionFailedAt: true } });
  if (!v) return null;
  const subInclude = { plan: { select: { key: true, track: true, level: true } } };
  const sub = (await prisma.v3PlanSubscription.findUnique({ where: { currentVendorId: v.id }, include: subInclude })) ?? (await prisma.v3PlanSubscription.findFirst({ where: { vendorId: v.id }, orderBy: { createdAt: 'desc' }, include: subInclude }));
  const cat = v.industry ? await prisma.v3PackCategory.findUnique({ where: { categoryKey: v.industry }, select: { minTier: true } }) : null;
  const cms = await prisma.vendorCMS.findUnique({ where: { vendorId: v.id }, select: { siteStatus: true, packKey: true, banner: true, address: true, phone: true } });
  const pubs = await prisma.v3SitePublication.findMany({ where: { vendorId: v.id }, orderBy: { version: 'desc' }, take: 3, select: { version: true, status: true, publishedAt: true, indexable: true, missingFieldsJson: true } });
  const host = v.subdomain ? `${v.subdomain}.${deps.baseDomain}` : null;
  const hostRow = host ? await prisma.v3Domain.findUnique({ where: { hostname: host }, select: { vendorId: true, status: true, kind: true } }) : null;
  const reviews = await prisma.v3DuplicateReview.findMany({ where: { vendorId: v.id }, select: { status: true } });
  const [plans, prices, taxRows] = await Promise.all([
    prisma.v3Plan.findMany({ where: { status: 'ACTIVE', isPublic: true } }),
    prisma.v3PlanPrice.findMany({ where: { status: 'APPROVED', effectiveFrom: { lte: now } } }),
    prisma.v3TaxRate.findMany({ where: { active: true } }),
  ]);
  const tax = deps.selectTaxRate(taxRows.map((t) => ({ name: t.name, ratePercent: Number(t.ratePercent), appliesTo: t.appliesTo, active: t.active, validFrom: t.validFrom })), now);
  const options = deps.shapePlanOptions({ now, heldTrack: sub?.plan?.track ?? null, categoryTier: cat?.minTier ?? null, plans, prices, tax: tax ? { name: tax.name, ratePercent: tax.ratePercent } : null });
  const category = deps.categoryProbe ? deps.categoryProbe(v.industry, options.track) : null;
  return { v, sub, cat, cms, pubs, host, hostRow, reviews, options, category, now };
}

function render(f) {
  const out = [];
  const { v, sub, cat, cms, pubs, hostRow, reviews, options } = f;
  out.push(`Vendor ${v.id}  (${v.role}, status ${v.status}, registered ${v.createdAt.toISOString().slice(0, 10)})`);
  out.push('');
  out.push('TRACK');
  out.push(`  category chosen at registration: ${v.industry ? `"${v.industry}"` : '(none)'}${cat ? `, known to the category list, minimum tier ${cat.minTier}` : v.industry ? ', NOT in the category list (the track then defaults to handyman at registration)' : ''}`);
  out.push(`  plan held: ${sub ? `${sub.plan.key} (${sub.plan.level}), subscription ${sub.status}${sub.termMonths ? `, term ${sub.termMonths} months` : ''}${sub.endsAt ? `, ends ${sub.endsAt.toISOString().slice(0, 10)}` : ''}` : 'none'}`);
  out.push(`  track the chooser uses: ${options.track ?? 'UNRESOLVED'}${options.trackSource ? ` (from the ${options.trackSource === 'PLAN' ? 'plan held' : 'category'})` : ''}`);
  out.push('');
  out.push('SITE');
  out.push(`  site row: ${cms ? `present, ${cms.siteStatus}, pack ${cms.packKey ?? '(none)'}, banner ${yn(!!cms.banner)}, address ${yn(!!cms.address)}, phone ${yn(!!cms.phone)}` : 'MISSING (no draft site was made)'}`);
  if (pubs.length === 0) out.push('  publications: none');
  for (const p of pubs) {
    const missing = Array.isArray(p.missingFieldsJson) ? p.missingFieldsJson.map((m) => m && m.code).filter(Boolean) : [];
    out.push(`  publication v${p.version}: ${p.status}${p.publishedAt ? `, published ${p.publishedAt.toISOString().slice(0, 10)}` : ''}, indexable ${yn(p.indexable)}${missing.length ? `, missing for search engines: ${missing.join(',')}` : ''}`);
  }
  out.push(`  build category: ${f.category === null ? '(not checked here: the theme kit could not be loaded)' : f.category === 'own' ? 'the vendor\'s own category is a kit design' : f.category === 'track-default' ? 'the category is not a kit design: the neutral design of the track is used (B6.1)' : 'NONE: the build would stop with PUBLISH_BLOCKED / CATEGORY'}`);
  out.push('');
  out.push('SITE PROVISIONING');
  out.push(`  siteProvisionStatus: ${v.siteProvisionStatus ?? '(none: no failure recorded)'}`);
  out.push(`  siteProvisionCode:   ${v.siteProvisionCode ?? '(none)'}${v.siteProvisionFailedAt ? `  failed at ${v.siteProvisionFailedAt.toISOString()}` : ''}`);
  const held = reviews.filter((r) => r.status !== 'CLEARED').length;
  out.push(`  duplicate review hold: ${reviews.length === 0 ? 'none' : held > 0 ? `HELD (${held} not cleared): publishing is blocked until staff clear it` : 'all cleared'}`);
  out.push('');
  out.push('ADDRESS');
  out.push(`  subdomain: ${v.subdomain ?? '(none)'}  (host ${f.host ?? 'none'})`);
  out.push(`  host row owner: ${!hostRow ? 'no host row' : hostRow.vendorId === v.id ? `this vendor (${hostRow.kind}, ${hostRow.status})` : `ANOTHER vendor (${hostRow.kind}, ${hostRow.status}): a real conflict`}`);
  out.push('');
  out.push('PLAN CHOOSER (what GET /v3/me/plan-options would answer)');
  if (options.reason) out.push(`  nothing to choose: ${options.reason}: ${options.message}`);
  for (const p of options.plans) {
    out.push(`  ${p.key} (${p.name})`);
    for (const t of p.terms) out.push(`    ${String(t.termMonths).padStart(2)} months  ${rupees(t.price.priceMinor)} before GST${t.purchasable ? '' : '  (no GST rate: not purchasable)'}`);
  }
  out.push('');
  out.push('(read only: nothing was written, nothing was sent)');
  return out;
}

module.exports = { parseArgs, collect, render };
