// Optional real-browser checks and screenshots, using Playwright that is ALREADY on this machine (nothing is installed by the kit).
// The library is looked up in: the `playwright` / `playwright-core` packages, $PLAYWRIGHT_MODULE, and the global npm folders.
// Chromium is looked up in $PLAYWRIGHT_CHROMIUM, then %LOCALAPPDATA%\ms-playwright (newest chromium-*). If anything is missing the
// functions return { available:false, reason } and callers skip politely; they never throw for a missing browser.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

let cached;

function globalRoots() {
  // No process is started to ask npm: the usual global folders are listed instead. PLAYWRIGHT_MODULE covers anything else.
  const home = os.homedir();
  return [process.env.NPM_GLOBAL_ROOT, process.env.APPDATA && path.join(process.env.APPDATA, 'npm', 'node_modules'), path.join(home, '.npm-global', 'lib', 'node_modules'), '/usr/local/lib/node_modules', '/usr/lib/node_modules'].filter(Boolean);
}

async function loadLibrary() {
  const candidates = [];
  if (process.env.PLAYWRIGHT_MODULE) candidates.push(process.env.PLAYWRIGHT_MODULE);
  for (const root of globalRoots()) {
    for (const rel of ['playwright', 'playwright-core', 'openclaw/node_modules/playwright-core', 'openclaw/node_modules/playwright']) candidates.push(path.join(root, rel));
  }
  const require = createRequire(import.meta.url);
  for (const name of ['playwright', 'playwright-core']) {
    try { return require(name); } catch { /* not installed here */ }
  }
  for (const dir of candidates) {
    try {
      if (!fs.existsSync(dir)) continue;
      const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
      const entry = typeof pkg.main === 'string' ? pkg.main : 'index.js';
      return createRequire(pathToFileURL(path.join(dir, 'x.js')))(path.join(dir, entry));
    } catch { /* try the next one */ }
  }
  return null;
}

function findChromium() {
  if (process.env.PLAYWRIGHT_CHROMIUM && fs.existsSync(process.env.PLAYWRIGHT_CHROMIUM)) return process.env.PLAYWRIGHT_CHROMIUM;
  const bases = [process.env.PLAYWRIGHT_BROWSERS_PATH, process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'ms-playwright'), path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright'), path.join(os.homedir(), '.cache', 'ms-playwright')].filter(Boolean);
  for (const base of bases) {
    if (!fs.existsSync(base)) continue;
    const dirs = fs.readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
    for (const d of dirs) {
      for (const rel of ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe', 'chrome-linux/chrome', 'chrome-linux64/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
        const p = path.join(base, d, rel);
        if (fs.existsSync(p)) return p;
      }
    }
  }
  return null;
}

/** @returns {Promise<{available:true, browser:any, close:()=>Promise<void>} | {available:false, reason:string}>} */
export async function openBrowser() {
  if (cached === undefined) {
    const lib = await loadLibrary();
    const exe = findChromium();
    cached = lib ? { lib, exe } : null;
    if (cached && !exe) cached.exe = undefined;
  }
  if (!cached) return { available: false, reason: 'Playwright library not found (set PLAYWRIGHT_MODULE to its folder)' };
  try {
    const browser = await cached.lib.chromium.launch({ executablePath: cached.exe, headless: true });
    return { available: true, browser, close: () => browser.close() };
  } catch (e) {
    return { available: false, reason: `Chromium could not start: ${String(e.message ?? e).split('\n')[0]}` };
  }
}

/** For each width, the horizontal overflow of the document: { width, scrollWidth, overflow, offenders[] }. */
export async function measureOverflow(browser, html, widths) {
  const ctx = await browser.newContext({ viewport: { width: widths[0], height: 900 }, javaScriptEnabled: false });
  const page = await ctx.newPage();
  const out = [];
  try {
    await page.setContent(html, { waitUntil: 'load' });
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      out.push({ width, ...(await page.evaluate(() => {
        const root = document.documentElement;
        const vw = root.clientWidth;
        const offenders = [];
        for (const el of document.body.querySelectorAll('*')) {
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          if (cs.position === 'fixed' || cs.display === 'none') continue;
          if (r.width > 0 && r.right > vw + 1 && offenders.length < 5) offenders.push(`${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? `.${el.className.split(' ')[0]}` : ''}`);
        }
        return { scrollWidth: root.scrollWidth, clientWidth: vw, overflow: root.scrollWidth > vw + 1, offenders };
      })) });
    }
  } finally { await ctx.close(); }
  return out;
}

export async function screenshot(browser, html, file, { width, height = 900, fullPage = true }) {
  const ctx = await browser.newContext({ viewport: { width, height }, javaScriptEnabled: false });
  const page = await ctx.newPage();
  try {
    await page.setContent(html, { waitUntil: 'load' });
    await page.screenshot({ path: file, fullPage });
  } finally { await ctx.close(); }
}
