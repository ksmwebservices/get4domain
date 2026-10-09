// Shared helpers for registry/build.mjs and registry/check.mjs (plain Node, no dependencies of its own: it borrows `typescript`
// from get4domain_mvp/node_modules to read the .ts sources).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'get4domain_mvp', 'package.json'));
const ts = require('typescript');

export const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
export const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

/** Transpile registry/*.ts into a temp folder and import them (types.ts has no runtime content; features/state are plain data + functions). */
export async function loadRegistry() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'g4d-registry-'));
  const out = {};
  for (const name of ['state', 'features', 'capabilities']) {
    const js = ts.transpileModule(read(`registry/${name}.ts`), { compilerOptions: { module: ts.ModuleKind.ES2020, target: ts.ScriptTarget.ES2020 } }).outputText;
    fs.writeFileSync(path.join(tmp, `${name}.mjs`), js);
  }
  fs.writeFileSync(path.join(tmp, 'types.mjs'), 'export {};');
  for (const name of ['state', 'features', 'capabilities']) out[name] = await import(pathToFileURL(path.join(tmp, `${name}.mjs`)).href);
  fs.rmSync(tmp, { recursive: true, force: true });
  return { ...out.state, ...out.features, ...out.capabilities };
}

export function sourceHash() {
  const h = crypto.createHash('sha256');
  for (const f of ['registry/types.ts', 'registry/state.ts', 'registry/features.ts', 'registry/capabilities.ts']) h.update(read(f));
  return h.digest('hex').slice(0, 16);
}

/** Embed a TS source file in a generated file: drop its own import lines (the types are embedded too). */
function embed(rel) {
  return read(rel).split('\n').filter((l) => !/^import\s/.test(l)).join('\n').trim();
}

export function generatedFiles(reg) {
  const hash = sourceHash();
  const header = (what) => `// GENERATED — do not edit. Source: registry/features.ts (+ types.ts, state.ts). Run \`npm run registry:build\` after changing the registry.\n// registry-hash: ${hash}\n// ${what}\n/* eslint-disable */\n`;
  const body = `${embed('registry/types.ts')}\n\n${embed('registry/state.ts')}\n\nexport const REGISTRY_HASH = '${hash}';\nexport const FEATURES: Feature[] = ${JSON.stringify(reg.FEATURES, null, 2)};\nexport const KEPT_ROUTES: { route: string; reason: string }[] = ${JSON.stringify(reg.KEPT_ROUTES, null, 2)};
export const CAPABILITIES: Capability[] = ${JSON.stringify(reg.CAPABILITIES, null, 2)};\n`;

  // Static legacy → v2 map (the dynamic /dashboard/domain-app/<tab> family is resolved by tabOwner()).
  const map = {};
  for (const f of reg.FEATURES) {
    for (const l of f.legacyRoutes ?? []) {
      const from = typeof l === 'string' ? l : l.from;
      const tab = typeof l === 'string' ? undefined : l.tab;
      map[from] = tab ? `${f.route}?tab=${tab}` : f.route;
    }
  }
  map['/dashboard/domain-app'] = '/dashboard';
  const owner = (id) => reg.FEATURES.find((f) => f.id === id).route;
  const redirects = `${header('Legacy dashboard address -> Dashboard v2 address. Applied ONLY for vendors with nav_v2 on (cookie g4d_nav_v2=1).')}
export const LEGACY_MAP: Record<string, string> = ${JSON.stringify(map, null, 2)};
export const TAB_TARGETS: Record<string, string> = ${JSON.stringify({
    products: owner('commerce.products'), customers: owner('sales.customers'), invoices: owner('finance.invoices'), orders: owner('commerce.orders'), workspace: owner('commerce.workspace'),
  }, null, 2)};
export const PRODUCT_TABS = ${JSON.stringify(reg.PRODUCT_TABS)};
export const CUSTOMER_TABS = ${JSON.stringify(reg.CUSTOMER_TABS)};
export const INVOICE_TABS = ${JSON.stringify(reg.INVOICE_TABS)};
export const ORDER_TABS = ${JSON.stringify(reg.ORDER_TABS)};
`;
  return {
    'get4domain_mvp/src/lib/nav.generated.ts': header('Navigation data + pure state logic for the dashboard.') + body,
    'get4domain_mvp/src/lib/redirects.generated.ts': redirects,
    'backend-api/src/registry/registry.generated.ts': header('Same registry for the API: provisioning, context endpoint, arrangements.') + body,
  };
}
