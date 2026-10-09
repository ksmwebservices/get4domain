'use strict';
// Shared by scripts/leadspace-migrate-campaigns.js (the CLI KSM runs on the VM) and the verify suite. Needs `npx nest build` first.
const path = require('path');

/** @param {*} prisma  a PrismaClient (or the harness one)  @param {{apply?: boolean, rollback?: boolean, vendor?: string}} opts  @param {(line: string) => void} log */
async function runMigration(prisma, opts, log = console.log) {
  const { LegacyImportService } = require(path.join(__dirname, '..', 'dist', 'src', 'leadspace', 'legacy-import.service'));
  const svc = new LegacyImportService(prisma);
  const apply = Boolean(opts.apply);
  let ids;
  if (opts.vendor) {
    const v = await prisma.vendor.findFirst({ where: { OR: [{ subdomain: opts.vendor }, { id: opts.vendor }] }, select: { id: true } });
    if (!v) { log(`No vendor with the subdomain or id "${opts.vendor}".`); return { vendors: 0, results: [] }; }
    ids = [v.id];
  } else ids = await svc.vendorsWithLegacy();
  log(opts.rollback ? (apply ? 'ROLLBACK: removing what the import created.' : 'ROLLBACK DRY RUN: nothing is removed. Add --apply to remove.') : (apply ? 'APPLY: copying Campaigns, landing pages and campaign leads into LeadSpace.' : 'DRY RUN: nothing is written. Add --apply to write.'));
  const results = [];
  for (const id of ids) {
    if (opts.rollback) {
      const r = await svc.rollback(id, apply);
      const v = await prisma.vendor.findUnique({ where: { id }, select: { businessName: true, subdomain: true } });
      log(`\n${v?.subdomain ?? id} (${v?.businessName ?? ''})`);
      log(`  Imported page: ${r.profileRemoved ? (apply ? 'removed' : 'would be removed') : r.profileKept ?? 'none made by the import'}`);
      log(`  Imported campaigns: ${r.postJobs}${apply ? ' removed' : ' would be removed'}; imported leads: ${r.leadEvents}${apply ? ' removed' : ' would be removed'}. The original rows are never touched.`);
      results.push(r);
      continue;
    }
    const r = await svc.run(id, apply);
    if (!r) continue;
    results.push(r);
    log(`\n${r.businessName} (${r.vendorId})`);
    const p = r.page;
    log(`  Landing page: ${p.action === 'CREATE' ? `${apply ? 'made' : 'will be made'} as a DRAFT LeadSpace page at /ls/${p.slug} (trade ${p.category}, city ${p.city}${p.cityGuessed ? ', GUESSED: ask the vendor to confirm' : ''}); the old /go/${p.slug} keeps working until they publish it` : p.action === 'HAS_PROFILE' ? 'the vendor already has a LeadSpace page; nothing to do' : 'none'}`);
    if (p.extraPages.length) log(`  Other landing pages (LeadSpace has one page per vendor; these stay as they are): ${p.extraPages.join(', ')}`);
    log(`  Campaigns: ${r.campaigns.toImport} of ${r.campaigns.total} ${apply ? 'copied' : 'to copy'} to the Promote tab as history`);
    log(`  Campaign leads: ${r.leads.toImport} of ${r.leads.total} ${apply ? 'copied' : 'to copy'} to the Leads tab (marked imported, never charged)`);
    log(`  DomainCampaign billing records: ${r.domainCampaignRecords}, left exactly where they are`);
  }
  log(`\n${ids.length} vendor(s) looked at. Nothing was deleted${apply && !opts.rollback ? '; the old rows remain, this is a copy' : ''}.`);
  return { vendors: ids.length, results };
}

module.exports = { runMigration };
