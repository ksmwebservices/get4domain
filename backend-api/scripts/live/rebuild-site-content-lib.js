'use strict';
/** S1.4: the parts of the content rebuild that can be tested without a database or a terminal. No phone number or e-mail address is ever an input or an output here. */

/** `--id <vendor id>` (only an id), optional `--apply` and `--staging`. Returns { ok, id, apply, staging } or { ok: false, problem }. */
function parseIdArgs(argv) {
  let id = null; let apply = false; let staging = false;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--apply') { apply = true; continue; }
    if (a === '--staging') { staging = true; continue; }
    if (a === '--id') {
      if (id) return { ok: false, problem: 'name the vendor once with --id' };
      id = argv[i + 1]; i += 1;
      if (!id || id.startsWith('--')) return { ok: false, problem: '--id needs a value' };
      continue;
    }
    return { ok: false, problem: `unknown argument ${a.startsWith('--') ? a : '(a bare value; use --id)'}` };
  }
  if (!id) return { ok: false, problem: 'give --id <vendor id>' };
  return { ok: true, id: id.trim(), apply, staging };
}

/** Only a non-suspended vendor account with a V3 plan may be rebuilt. */
function decideRebuild(v, state) {
  if (!v) return { ok: false, problem: 'no vendor has that id' };
  if (v.role !== 'VENDOR') return { ok: false, problem: `that account is a ${String(v.role).toLowerCase()} account, not a vendor` };
  if (v.status === 'SUSPENDED') return { ok: false, problem: 'that vendor is suspended' };
  if (!state || !state.sub) return { ok: false, problem: 'that vendor holds no V3 plan, so there is no V3 site to rebuild' };
  return { ok: true, problem: null };
}

const empty = (x) => String(x ?? '').trim() === '';

/** What a rebuild would do, from the vendor's current rows. */
function dryRebuildLines(v, state) {
  const c = state.cms;
  const fill = [];
  if (!c || empty(c.tagline)) fill.push('tagline');
  if (!c || empty(c.about)) fill.push('about text');
  if (state.products === 0) fill.push('the generic services of the track (sample, no prices)');
  return [
    `Vendor ${v.id}: plan ${state.sub.plan.key}, category as typed "${v.industry ?? ''}", address ${v.subdomain ? 'reserved' : 'none'}.`,
    `Site row: ${c ? `${c.siteStatus}${c.siteStatus === 'LIVE' ? '' : ' (the public site app answers 404 for any row that is not LIVE; the rebuild sets it to LIVE after a successful publish)'}` : 'missing (a draft site would be made)'}. Published V3 site: ${state.published ? `v${state.published.version}` : 'none'}. Address block: ${c && !empty(c.address) ? 'present' : 'none (not invented)'}.`,
    fill.length ? `Would fill, only where empty: ${fill.join('; ')}. The owner's own words are never replaced.` : 'Nothing to fill: the home content already exists.',
    'Then: build the site (a new version only if something changed), publish it, and set the site row to LIVE. Free stays an information page and stays not indexable until claimed and verified.',
  ];
}

function resultLines(answer, after) {
  return [
    `Result: ${answer.status}${answer.published ? ' (published)' : ''}.`,
    `Site row ${after.cms ? after.cms.siteStatus : 'missing'}; tagline ${after.cms && !empty(after.cms.tagline) ? 'set' : 'empty'}; about ${after.cms && !empty(after.cms.about) ? 'set' : 'empty'}; ${after.products} catalogue row(s); published V3 site ${after.published ? `v${after.published.version}` : 'none'}.`,
  ];
}

module.exports = { parseIdArgs, decideRebuild, dryRebuildLines, resultLines };
