import * as fs from 'fs';
import * as path from 'path';

/**
 * S54.3: ONE renderer. The theme kit in themes/ is the only source; the backend gets it through a build-time transform into dist/renderer (generated, git-ignored,
 * never committed). This test fails if a second copy of the renderer, a theme package, or a hand-made copy of the kit's library ever appears under backend-api,
 * or if the build script stops reading the shared folder. The kit's own 255 tests keep running in themes/.
 */
const backend = path.resolve(__dirname, '..');
const repoRoot = path.resolve(backend, '..');
const SKIP = new Set(['node_modules', 'dist', '.git', 'coverage']);

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
const files = walk(backend);
const rel = (f: string): string => path.relative(backend, f).replace(/\\/g, '/');

describe('single copy of the renderer', () => {
  it('the kit source exists exactly where the build reads it', () => {
    expect(fs.existsSync(path.join(repoRoot, 'themes/lib/render.mjs'))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, 'themes/library/free-practice/theme.json'))).toBe(true);
  });

  it('backend-api holds no renderer source: no renderPage definition anywhere outside the generated dist (remotion/render.mjs is an unrelated video script)', () => {
    const offenders = files.filter((f) => {
      if (/\.test\.|\.spec\./.test(f) || rel(f) === 'scripts/build-renderer.js') return false;
      if (!/\.(ts|js|mjs|cjs)$/.test(f)) return false;
      return /(export\s+)?function\s+renderPage\s*\(/.test(fs.readFileSync(f, 'utf8'));
    }).map(rel);
    expect(offenders).toEqual([]);
  });

  it('the detector itself works: it flags a pasted renderer and ignores a call', () => {
    const re = /(export\s+)?function\s+renderPage\s*\(/;
    expect(re.test('export function renderPage(input) { return {}; }')).toBe(true);
    expect(re.test('function renderPage (x) {}')).toBe(true);
    expect(re.test('const r = kit.renderPage({ page })')).toBe(false);
  });

  it('backend-api holds no theme package or copy of the kit library or category map', () => {
    const offenders = files.filter((f) => /(^|\/)theme\.json$/.test(rel(f)) || /(^|\/)category-map\.json$/.test(rel(f)) || /(^|\/)themes?\/library\//.test(rel(f))).map(rel);
    expect(offenders).toEqual([]);
  });

  it('there is no themes/ folder inside backend-api', () => {
    expect(fs.existsSync(path.join(backend, 'themes'))).toBe(false);
  });

  it('the build script reads the shared themes/ folder and writes only under dist or a cache folder', () => {
    const script = fs.readFileSync(path.join(backend, 'scripts/build-renderer.js'), 'utf8');
    expect(script).toMatch(/'\.\.', 'themes'|\.\.\/themes/);
    expect(script).not.toMatch(/writeFileSync\([^)]*backend[^)]*src/);
    expect(fs.readFileSync(path.join(backend, 'package.json'), 'utf8')).toMatch(/build-renderer/);
  });

  it('the generated output is git-ignored (dist/ is ignored)', () => {
    const ignore = fs.readFileSync(path.join(backend, '.gitignore'), 'utf8').split(/\r?\n/).map((l) => l.trim());
    expect(ignore.some((l) => l === 'dist' || l === '/dist' || l === 'dist/' || l === '/dist/')).toBe(true);
  });
});
