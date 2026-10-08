const fs = require('fs'), path = require('path'), cp = require('child_process');
const root = 'C:/Get4Domain/get4domain-site/get4domain_mvp/src';
const OUT = process.env.TEMP + '/audit';
const read = (f) => fs.readFileSync(f, 'utf8');
const norm = (p) => p.split(path.sep).join('/');

// 1. lib/api.ts method -> "VERB /endpoint"
const apiSrc = read(path.join(root, 'lib/api.ts'));
const methods = {};
const lines = apiSrc.split('\n');
let cur = null;
for (let i = 0; i < lines.length; i += 1) {
  const l = lines[i];
  const mm = l.match(/^\s{2}(\w+):\s*(?:async\s*)?(?:\(|\w+\s*=>)/);
  if (mm) cur = mm[1];
  if (cur && !methods[cur]) {
    const ep = l.match(/apiCall\(\s*[`'"]([^`'"]+)[`'"]/);
    if (ep) {
      const ctx = lines.slice(i, i + 4).join(' ');
      const verb = (ctx.match(/method:\s*['"](\w+)['"]/) || [])[1] || 'GET';
      methods[cur] = `${verb} ${ep[1].replace(/\$\{[^}]*\}/g, ':id').split('?')[0]}`;
    }
  }
}
fs.writeFileSync(OUT + '/api-methods.json', JSON.stringify(methods, null, 1));
console.log('api.ts methods mapped:', Object.keys(methods).length);

function resolveImport(from, spec) {
  let base;
  if (spec.startsWith('@/')) base = path.join(root, spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(from), spec);
  else return null;
  for (const ext of ['.tsx', '.ts', '/index.tsx', '/index.ts']) if (fs.existsSync(base + ext)) return base + ext;
  return null;
}
function collect(file, seen = new Set(), depth = 0) {
  if (seen.has(file) || depth > 3) return seen;
  seen.add(file);
  const src = read(file);
  for (const mm of src.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
    const r = resolveImport(file, mm[1]);
    const n = r ? norm(r) : '';
    if (r && !/lib\/(api|auth|auth-context|utils)\.tsx?$/.test(n) && !/components\/(ui|vendor|design)\//.test(n)) collect(r, seen, depth + 1);
  }
  return seen;
}
const dash = path.join(root, 'app/dashboard');
const pages = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name === 'page.tsx') pages.push(p); } })(dash);
const out = [];
for (const page of pages.sort()) {
  const files = [...collect(page)];
  const apis = new Set(), raw = new Set();
  let total = 0;
  for (const f of files) {
    const src = read(f); total += src.split('\n').length;
    for (const mm of src.matchAll(/\bapi\.(\w+)\(/g)) apis.add(mm[1]);
    for (const mm of src.matchAll(/apiCall\(\s*[`'"]([^`'"]+)[`'"]/g)) raw.add('apiCall ' + mm[1].replace(/\$\{[^}]*\}/g, ':id').split('?')[0]);
    for (const mm of src.matchAll(/fetch\(\s*[`'"]?\$?\{?[A-Za-z_.]*\}?([^`'")]*)/g)) if (/\/(public|billing|admin|cms|uploads|ai|reels|video)/.test(mm[1])) raw.add('fetch ' + mm[1].replace(/\$\{[^}]*\}/g, ':id').split('?')[0]);
    for (const mm of src.matchAll(/\b(commerceApi|billingApi)\.(\w+)/g)) raw.add(`${mm[1]}.${mm[2]}`);
  }
  let last = '';
  try { last = cp.execSync(`git log -1 --format=%cs -- "${page}"`, { cwd: 'C:/Get4Domain/get4domain-site' }).toString().trim(); } catch { /* ignore */ }
  const rel = norm(path.relative(dash, path.dirname(page)));
  out.push({
    route: '/dashboard' + (rel ? '/' + rel : ''), page: norm(path.relative(root, page)), pageLines: read(page).split('\n').length, totalLines: total, last,
    files: files.map((f) => norm(path.relative(root, f))),
    endpoints: [...apis].map((a) => (methods[a] ? `${a} → ${methods[a]}` : `${a} → (unmapped)`)).concat([...raw]),
  });
}
fs.writeFileSync(OUT + '/inventory.json', JSON.stringify(out, null, 1));
for (const o of out) console.log(o.route.padEnd(34), String(o.pageLines).padStart(5), String(o.totalLines).padStart(6), o.last, '|', o.files.length - 1, 'sub |', o.endpoints.length, 'ep');
