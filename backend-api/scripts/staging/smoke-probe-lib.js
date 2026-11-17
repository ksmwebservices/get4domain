/* Pure parts of the smoke probe: which routes to call, what each role is expected to get, how an answer is judged, how the table is written. No network, no file reads, no secret handling
 * beyond `redactAll`. Unit-tested in test/smoke-probe.spec.ts.
 */
const PRINCIPALS = Object.freeze(['superAdmin', 'admin', 'sales', 'operations', 'partner', 'vendorFree', 'vendorPaid']);
/** The matrix's name for each staff principal (SALES is stored as MARKETING). */
const STAFF_ROLE = Object.freeze({ superAdmin: 'SUPER_ADMIN', admin: 'ADMIN', sales: 'MARKETING', operations: 'OPERATIONS' });
const VENDORS = Object.freeze(['vendorFree', 'vendorPaid']);

/** GET routes that reach a provider or a long job: never probed. */
const EXCLUDE = Object.freeze(['/v3/me/domain-sales/search']);
/** Query strings a route needs to be answered at all (taken from the contracts). */
const QUERY = Object.freeze({
  '/v3/public/subdomain-availability': '?name=smoke-probe-name',
  '/v3/public/themes': '?pack=handyman',
  '/v3/public/site/by-host': '?host=smoke-free-site.get4domain.com',
});
const GROUPS = ['/v3/public/', '/v3/partner/', '/v3/me/', '/v3/admin/'];
/** A refusal that is a plan or entitlement gate (the role is allowed in; the vendor's plan lacks the feature). */
const GATE_CODE = /PLAN|ENTITLE|FEATURE|ADDON|TAB_|MODULE|UPGRADE|PACK|NOT_IN/i;

function kindOf(p) {
  if (p === '/health' || p.startsWith('/v3/public/')) return 'public';
  if (p.startsWith('/v3/partner/')) return 'partner';
  if (p === '/auth/me') return 'any';
  if (p.startsWith('/v3/me/')) return 'vendor';
  if (p.startsWith('/v3/admin/')) return 'admin';
  return null;
}

/** Fills the path params the probe knows (a vendor id, the referral code). Returns null when a param stays unknown. */
function fillParams(p, ids) {
  let out = p;
  if (/^\/v3\/admin\/vendors\/:id\//.test(out) && ids.vendor) out = out.replace(':id', ids.vendor);
  if (out === '/v3/public/referral/:code' && ids.referralCode) out = out.replace(':code', ids.referralCode);
  return out.includes(':') ? null : out;
}

/**
 * Which routes to call: every GET of the public, partner, vendor (/v3/me) and admin (/v3/admin) areas, plus /auth/me and /health, from the reviewed route baseline. A route whose path params the probe
 * cannot fill is listed as skipped (not silently dropped).
 */
function planRoutes(baselineRoutes, matrix, ids = {}) {
  const routes = []; const skipped = [];
  const extra = [{ route: 'GET /health' }, { route: 'GET /auth/me' }];
  for (const r of [...extra, ...baselineRoutes]) {
    if (!r.route.startsWith('GET ')) continue;
    const pattern = r.route.slice(4);
    if (pattern !== '/health' && pattern !== '/auth/me' && !GROUPS.some((g) => pattern.startsWith(g))) continue;
    if (routes.some((x) => x.key === r.route) || skipped.some((x) => x.key === r.route)) continue;
    if (EXCLUDE.includes(pattern)) { skipped.push({ key: r.route, why: 'reaches a provider' }); continue; }
    const filled = fillParams(pattern, ids);
    if (!filled) { skipped.push({ key: r.route, why: 'needs an id the seed does not know' }); continue; }
    routes.push({ key: r.route, pattern, path: filled + (QUERY[pattern] || ''), kind: kindOf(pattern), cls: r.cls, staffRoles: kindOf(pattern) === 'admin' ? [...matrix.effectiveRolesFor(r.route)] : null });
  }
  return { routes, skipped };
}

/** 'allow' or 'refuse' for one route and principal ('anon' is a caller with no token). */
function expectedFor(route, principal) {
  const anon = principal === 'anon';
  switch (route.kind) {
    case 'public': return 'allow';
    case 'any': return anon ? 'refuse' : 'allow';
    case 'partner': return principal === 'partner' ? 'allow' : 'refuse';
    case 'vendor': return VENDORS.includes(principal) ? 'allow' : 'refuse';
    case 'admin': return STAFF_ROLE[principal] && route.staffRoles.includes(STAFF_ROLE[principal]) ? 'allow' : 'refuse';
    default: return 'refuse';
  }
}

/** PASS: as expected. GATED: an allowed role stopped by a plan or entitlement gate. REACH: an allowed role got past the guards and was asked for input (400, 404, 409, 422). FAIL: anything else. */
function judge(expected, status, code) {
  if (expected === 'refuse') return status === 401 || status === 403 ? 'PASS' : 'FAIL';
  if (status >= 200 && status < 300) return 'PASS';
  if (status === 401 || status === 403) return GATE_CODE.test(code || '') ? 'GATED' : 'FAIL';
  if ([400, 404, 409, 422].includes(status)) return 'REACH';
  return 'FAIL';
}

const ORDER = { PASS: 0, GATED: 1, REACH: 2, FAIL: 3 };

/** Groups the raw answers [{ r, p, status, code }] into one row per route. */
function collect(routes, answers) {
  return routes.map((r) => {
    const cells = {}; let worst = 'PASS';
    for (const a of answers.filter((x) => x.r === r)) {
      const expected = expectedFor(r, a.p);
      const verdict = judge(expected, a.status, a.code);
      cells[a.p] = { expected, status: a.status, code: a.code || null, verdict };
      if (ORDER[verdict] > ORDER[worst]) worst = verdict;
    }
    return { route: r.key, kind: r.kind, cells, verdict: worst };
  });
}

const COLS = ['anon', ...PRINCIPALS];
const cell = (c) => (!c ? '-' : c.verdict === 'FAIL' ? `${c.status} WANT-${c.expected === 'allow' ? 'IN' : 'OUT'}${c.code ? ` ${c.code}` : ''}` : c.verdict === 'PASS' ? String(c.status) : `${c.status} ${c.verdict}`);

function renderMarkdown(rows, plan, meta = {}) {
  const count = (v) => rows.filter((r) => r.verdict === v).length;
  const L = [];
  L.push('# SMOKE RESULTS A3 (backend lane)', '');
  L.push(`Generated by \`scripts/staging/smoke-probe.js\` against the local API on staging (${meta.api || 'http://localhost'}), gateways off. GET requests only. No token or password is printed or stored here.`, '');
  L.push(`Routes probed: ${rows.length} (public, partner, vendor \`/v3/me\`, admin \`/v3/admin\`, plus \`/auth/me\` and \`/health\`), each as 8 callers: anon, SUPER_ADMIN, ADMIN, SALES (stored as MARKETING), OPERATIONS, partner, vendor on the Free plan, vendor on the paid plan. Skipped: ${plan.skipped.length}.`, '');
  L.push(`Result: **${count('PASS')} PASS, ${count('GATED')} with a plan gate for a vendor, ${count('REACH')} reached (the route wants input), ${count('FAIL')} FAIL** (a route counts at its worst cell).`, '');
  L.push('How "expected" is decided: public routes: everyone. Admin routes: the staff roles the role matrix gives that route (`effectiveRolesFor`), everyone else refused (401 anon, 403 others). Partner routes: the partner only. Vendor routes: the two vendors only. `/auth/me`: any signed-in caller. Judging: PASS = as expected; GATED = a vendor stopped by a plan or entitlement code; REACH = past the guards, asked for input (400, 404, 409 or 422); FAIL = a role let in that should be refused, refused that should be let in without a gate code, or a server error.', '');
  const bad = rows.filter((r) => r.verdict === 'FAIL');
  L.push('## Failures', '');
  if (!bad.length) L.push('None.', '');
  else {
    L.push('| route | role | expected | got | code |', '|---|---|---|---|---|');
    for (const r of bad) for (const p of COLS) { const c = r.cells[p]; if (c && c.verdict === 'FAIL') L.push(`| \`${r.route}\` | ${p} | ${c.expected === 'allow' ? 'in' : 'refused'} | ${c.status} | ${c.code || ''} |`); }
    L.push('');
  }
  L.push('## Full table', '', `| route | ${COLS.join(' | ')} |`, `|---|${COLS.map(() => '---').join('|')}|`);
  for (const r of rows) L.push(`| \`${r.route.replace(/^GET /, '')}\` | ${COLS.map((p) => cell(r.cells[p])).join(' | ')} |`);
  L.push('', '## Skipped', '');
  for (const s of plan.skipped) L.push(`- \`${s.key}\`: ${s.why}`);
  L.push('');
  return L.join('\n');
}

/** What the console shows: only the failures, compactly. */
function renderConsole(rows) {
  const lines = [];
  for (const r of rows.filter((x) => x.verdict === 'FAIL')) {
    const bad = COLS.filter((p) => r.cells[p] && r.cells[p].verdict === 'FAIL').map((p) => `${p}=${cell(r.cells[p])}`);
    lines.push(`FAIL ${r.route}  ${bad.join('; ')}`);
  }
  return lines.join('\n');
}

function redactAll(text, secrets) {
  const list = [...new Set((secrets || []).filter((s) => typeof s === 'string' && s.length >= 4))].sort((a, b) => b.length - a.length);
  return list.reduce((acc, s) => acc.split(s).join('***'), String(text));
}

module.exports = { PRINCIPALS, STAFF_ROLE, EXCLUDE, QUERY, kindOf, fillParams, planRoutes, expectedFor, judge, collect, renderMarkdown, renderConsole, redactAll, COLS };
