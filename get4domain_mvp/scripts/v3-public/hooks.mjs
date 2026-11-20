// Resolves "@/..." to src/ and adds .ts or .tsx to extensionless relative imports, exactly as the app bundler does.
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function find(base) {
  for (const ext of ['', '.ts', '.tsx', '/index.ts']) {
    const p = base + ext;
    if (existsSync(p) && statSync(p).isFile()) return p;
  }
  return null;
}

export async function resolve(specifier, context, next) {
  // Next's own entry points are CommonJS files named without an extension; Node's ESM loader needs the extension
  if (specifier === 'next/server' || specifier === 'next/headers' || specifier === 'next/navigation') return next(`${specifier}.js`, context);
  let base = null;
  if (specifier.startsWith('@/')) base = path.join(root, 'src', specifier.slice(2));
  else if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL && context.parentURL.startsWith('file:')) {
    base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
  }
  if (base) {
    const file = find(base);
    if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
  }
  return next(specifier, context);
}

// P11: lets a test render a real component. A .tsx file is turned into plain JavaScript with the project's own TypeScript (JSX runtime, no build step, no new dependency).
// Plain .ts files keep going through Node's own type stripping.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const requireTs = createRequire(import.meta.url);
export async function load(url, context, next) {
  if (url.startsWith('file:') && url.endsWith('.tsx')) {
    const ts = requireTs('typescript');
    const out = ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: fileURLToPath(url) });
    return { format: 'module', source: out.outputText, shortCircuit: true };
  }
  return next(url, context);
}
