// Shared helpers for the industry-designs scripts: start the built Next.js site, take screenshots with the machine's Chrome (puppeteer-core).
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '..', '..');
export const FE = path.join(ROOT, 'get4domain_mvp');
const req = createRequire(path.join(FE, 'package.json'));

export const CHROME = [
  process.env.G4D_CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find((p) => p && fs.existsSync(p));

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launchBrowser() {
  if (!CHROME) throw new Error('No Chrome or Edge found. Set G4D_CHROME to its path.');
  const puppeteer = req('puppeteer-core');
  return puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'] });
}

/** True when nothing is listening on the port. A server left over from an earlier run would answer instead of the new one and hide real problems. */
export function portFree(port) {
  return new Promise((resolve) => { const s = net.createServer(); s.once('error', () => resolve(false)); s.once('listening', () => s.close(() => resolve(true))); s.listen(port, '127.0.0.1'); });
}

export async function startNext(port, env = {}) {
  if (!(await portFree(port))) throw new Error(`Port ${port} is already in use (a website from an earlier run?). Stop it first, then run again.`);
  const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['next', 'start', '-p', String(port)], { cwd: FE, shell: true, stdio: 'ignore', env: { ...process.env, ...env } });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 60; i++) { try { const r = await fetch(`${base}/`); if (r.status < 500) return { child, base }; } catch { /* starting */ } await sleep(1500); }
  child.kill();
  throw new Error('The website did not start. Build it first: npm run build (in get4domain_mvp).');
}

export function stop(child) {
  if (!child) return;
  try { if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' }); else child.kill('SIGTERM'); } catch { /* already gone */ }
}

/** Screenshot a URL at a viewport; waits for images; trims very tall pages to maxHeight. */
export async function shot(browser, url, file, { width = 1280, height = 900, maxHeight = 4200, extraHeaders, format = 'png' } = {}) {
  const page = await browser.newPage();
  try {
    await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: width < 700, hasTouch: width < 700 });
    if (extraHeaders) await page.setExtraHTTPHeaders(extraHeaders);
    // reduced motion switches the reveal-on-scroll animation off, so every section is visible in the picture
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    // reveal-on-scroll sections: scroll through once so everything is visible
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } window.scrollTo(0, 0); });
    await sleep(400);
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await page.screenshot({ path: file, type: format, ...(format === 'webp' || format === 'jpeg' ? { quality: 60 } : {}), clip: { x: 0, y: 0, width, height: Math.min(h, maxHeight) } });
    return { height: h, html: await page.content() };
  } finally { await page.close(); }
}
