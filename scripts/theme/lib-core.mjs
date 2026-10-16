// Loads the theme core (backend-api/src/themes/core) as it is, TypeScript included, so the lint command and the registration command use exactly the rules the admin upload uses.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const api = resolve(here, '..', '..', 'backend-api');
const req = createRequire(join(api, 'package.json'));

let ts;
try { ts = req('typescript'); } catch { console.error('Run "npm install" inside backend-api first (the lint uses its TypeScript and its HTML and CSS readers).'); process.exit(2); }
req.extensions['.ts'] = (m, filename) => {
  const out = ts.transpileModule(readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, resolveJsonModule: true } });
  m._compile(out.outputText, filename);
};
// the loader above is registered on this require only; modules it loads use the shared Module._extensions
// eslint-disable-next-line no-underscore-dangle
const Module = req('module'); Module._extensions['.ts'] = req.extensions['.ts'];
const core = req(join(api, 'src', 'themes', 'core', 'index.ts'));

export { core };
