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
