// Starts the real API (in-memory Postgres) and the real website (a production build made against that API) for the industry-designs scripts and tests.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { FE, ROOT, startNext, stop } from './lib-shot.mjs';

const require = createRequire(import.meta.url);
export const SECRET = 'designs-test-secret';

function newestMtime(dir) {
  let m = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next') continue;
    const p = path.join(dir, e.name);
    m = Math.max(m, e.isDirectory() ? newestMtime(p) : fs.statSync(p).mtimeMs);
  }
  return m;
}

/** Builds the website against the test API unless a build newer than the source already exists. */
export function ensureBuild(api) {
  const marker = path.join(FE, '.next', 'g4d-render-test-api');
  const built = fs.existsSync(marker) && fs.readFileSync(marker, 'utf8') === api && fs.existsSync(path.join(FE, '.next', 'BUILD_ID'));
  if (built && fs.statSync(marker).mtimeMs > Math.max(newestMtime(path.join(FE, 'src')), newestMtime(path.join(FE, 'public')))) return 'reused';
  const r = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['next', 'build'], { cwd: FE, shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, NEXT_PUBLIC_API_URL: api, INTERNAL_API_URL: api } });
  if (r.status !== 0) throw new Error(`frontend build failed: ${(r.stdout + r.stderr).split('\n').filter((l) => /error/i.test(l)).slice(0, 4).join(' | ')}`);
  fs.writeFileSync(marker, api);
  return 'built';
}

export async function startStack({ apiPort = 3097, frontPort = 3023, pgPort = 54341 } = {}) {
  const { startHarness, available } = require(path.join(ROOT, 'backend-api', 'scripts', 'e2e', 'bos-harness'));
  if (!(await available())) return null;
  const API = `http://127.0.0.1:${apiPort}`;
  process.env.FRONTEND_INTERNAL_URL = `http://127.0.0.1:${frontPort}`; process.env.REVALIDATE_SECRET = SECRET;
  const build = ensureBuild(API);
  const h = await startHarness({ port: apiPort, pgPort });
  const next = await startNext(frontPort, { NEXT_PUBLIC_API_URL: API, INTERNAL_API_URL: API, REVALIDATE_SECRET: SECRET });
  return { h, build, API, FRONT: next.base, async stop() { stop(next.child); try { await h.stop(); } catch { /* shutting down */ } } };
}
