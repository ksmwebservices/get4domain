'use strict';
// Pure analysis for scripts/nav-v2-dry-run.js (kept separate so the verify suite can run it against a fake database). READ-ONLY: only find*/count calls.
//
// For one vendor: which plan/profile they are, which modules they have today, what the Dashboard v2 menu would show them (Open / Locked / Coming soon),
// and the "would lose access" list = modules they have switched on AND hold data in, whose screens Dashboard v2 would not offer as Open.
// Acceptance for Release 1A: that list is empty for every vendor KSM switches over.

/** module key -> [model, extra where] probes that say "this vendor really uses it". Modules not listed have no data of their own (wallet, AI Studio). */
const MODULE_DATA = {
  telecrm: [['campaignLead']],
  growth_hub: [['campaignPage'], ['campaign']],
  communication_hub: [['message'], ['whatsappConversation']],
  website_manager: [['vendorProduct'], ['posSale']],
  customer_hub: [['contact', { portalAccess: true }]],
  domainapp: [['record'], ['genericInvoice'], ['contact']],
  analytics_hub: [],
};

const RANK = { WORKSPACE: 1, BOS: 2 };

/**
 * @param {*} prisma  read-only use only
 * @param {{ FEATURES: any[], featureState: Function, buildMenu: Function, profileOfIndustry: Function, planDisplayName: Function }} reg  the generated registry
 * @param {{ key: string, defaultEnabled: boolean }[]} availableModules
 * @param {{ id: string, subdomain: string|null, businessName: string, industry: string|null, createdAt: Date, status?: string, isSandbox?: boolean }} vendor
 * @param {string} defaultFromIso NAV_V2_DEFAULT_FROM
 */
async function analyseVendor(prisma, reg, availableModules, vendor, defaultFromIso) {
  const [term, moduleRows, addonRows] = await Promise.all([
    prisma.billingTerm.findFirst({ where: { vendorId: vendor.id, isCurrent: true } }),
    prisma.vendorModule.findMany({ where: { vendorId: vendor.id } }),
    prisma.vendorAddon.findMany({ where: { vendorId: vendor.id } }),
  ]);
  const plan = term && RANK[term.planKey] ? term.planKey : 'WORKSPACE';
  const custom = addonRows.some((a) => a.addonKey === 'bos_custom' && a.enabled);
  const navRow = addonRows.find((a) => a.addonKey === 'nav_v2');
  const navV2Now = navRow ? navRow.enabled : new Date(vendor.createdAt).getTime() >= new Date(defaultFromIso).getTime();
  const profile = reg.profileOfIndustry(vendor.industry);
  const facts = { plan, custom, profile, navV2: true };

  const modOn = new Map(moduleRows.map((m) => [m.moduleKey, m.enabled]));
  const enabledModules = availableModules.filter((m) => (modOn.has(m.key) ? modOn.get(m.key) : m.defaultEnabled)).map((m) => m.key);

  const menu = reg.buildMenu(reg.FEATURES, facts);
  const count = { OPEN: 0, LOCKED: 0, COMING_SOON: 0 };
  const locked = [];
  for (const d of menu) for (const i of d.items) { count[i.state] = (count[i.state] || 0) + 1; if (i.state === 'LOCKED') locked.push(i.label); }

  // A module is "offered" when at least one feature that needs it is Open for this vendor (the menu-hidden Stationery still counts: it stays reachable).
  const offered = new Set();
  for (const f of reg.FEATURES) {
    if (f.moduleKey && reg.featureState({ ...f, hidden: false }, facts) === 'OPEN') offered.add(f.moduleKey);
  }
  const hasFeature = new Set(reg.FEATURES.filter((f) => f.moduleKey).map((f) => f.moduleKey));

  const wouldLose = [];
  for (const key of enabledModules) {
    if (!hasFeature.has(key) || offered.has(key)) continue;
    const probes = MODULE_DATA[key] ?? [];
    const found = [];
    for (const [model, extra] of probes) {
      const n = await prisma[model].count({ where: { vendorId: vendor.id, ...(extra ?? {}) } });
      if (n > 0) found.push(`${n} ${model}`);
    }
    if (found.length) {
      const features = reg.FEATURES.filter((f) => f.moduleKey === key).map((f) => `${f.label} (${reg.featureState({ ...f, hidden: false }, facts)})`);
      wouldLose.push({ module: key, data: found, screens: features });
    }
  }
  return {
    vendorId: vendor.id, subdomain: vendor.subdomain, businessName: vendor.businessName, status: vendor.status ?? null, sandbox: Boolean(vendor.isSandbox),
    plan, planName: reg.planDisplayName(plan), hasTerm: Boolean(term), custom, profile, navV2Now, enabledModules,
    counts: { open: count.OPEN, locked: count.LOCKED, comingSoon: count.COMING_SOON }, locked, wouldLose,
  };
}

function renderReport(results, meta) {
  const L = [];
  L.push('# Dashboard v2 dry run (read-only)');
  L.push('');
  L.push(`Generated ${meta.at} against database host \`${meta.host}\`. Nothing was written.`);
  L.push('');
  L.push(`Vendors: ${results.length}. Blocked (would lose access to something they use): **${results.filter((r) => r.wouldLose.length).length}**.`);
  L.push('');
  L.push('| Vendor | Plan | Profile | v2 now | Open | Locked | Coming soon | Would lose access |');
  L.push('|---|---|---|---|---|---|---|---|');
  for (const r of results) {
    L.push(`| ${r.businessName} (${r.subdomain ?? r.vendorId}) | ${r.planName}${r.hasTerm ? '' : ' (no term yet)'}${r.custom ? ' + Custom' : ''} | ${r.profile} | ${r.navV2Now ? 'ON' : 'off'} | ${r.counts.open} | ${r.counts.locked} | ${r.counts.comingSoon} | ${r.wouldLose.length ? '**' + r.wouldLose.length + '**' : '0'} |`);
  }
  const blocked = results.filter((r) => r.wouldLose.length);
  L.push('');
  if (blocked.length === 0) {
    L.push('## Would lose access');
    L.push('');
    L.push('Nobody. Every module a vendor has switched on and holds data in is still offered as Open by Dashboard v2 for their plan.');
  } else {
    L.push('## Would lose access (do NOT switch these vendors on until resolved)');
    for (const r of blocked) {
      L.push('');
      L.push(`### ${r.businessName} (${r.subdomain ?? r.vendorId}) — ${r.planName}`);
      for (const w of r.wouldLose) L.push(`- module \`${w.module}\`: holds ${w.data.join(', ')}; Dashboard v2 shows ${w.screens.join(', ')}`);
    }
  }
  L.push('');
  L.push('Provisioning only ever grants access, so a plan change cannot remove a module; the list above is about what the NEW MENU offers.');
  return L.join('\n') + '\n';
}

module.exports = { analyseVendor, renderReport, MODULE_DATA };
