// Phase 0 evidence: screenshot every existing engine render (the 14 kit industries + the 2 hand-built ones) as it is today, and list which section layouts each one uses.
//   node scripts/industry-designs/audit-before.mjs        (needs a built frontend: npm run build in get4domain_mvp)
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, launchBrowser, startNext, stop, shot } from './lib-shot.mjs';

const OUT = path.join(ROOT, 'evidence', 'industry-designs', 'before');
const INDUSTRIES = ['realestate', 'retail', 'clinic', 'salon', 'gym', 'coaching', 'education', 'professional', 'finance', 'diagnostics', 'photography', 'hotel', 'events', 'travel', 'restaurant', 'agriculture', 'automobile', 'construction', 'technology', 'logistics'];

const { child, base } = await startNext(3024);
const browser = await launchBrowser();
const usage = {};
try {
  for (const ind of INDUSTRIES) {
    const r = await shot(browser, `${base}/engine/preview/${ind}`, path.join(OUT, `${ind}-desktop.webp`), { maxHeight: 3600, format: 'webp' });
    const layouts = [...new Set([...r.html.matchAll(/data-layout="([^"]+)"/g)].map((m) => m[1]))];
    usage[ind] = layouts;
    console.log(`${ind}: ${layouts.join(', ') || '(bespoke layout, no kit sections)'}`);
  }
  fs.writeFileSync(path.join(OUT, 'section-usage.json'), JSON.stringify(usage, null, 2));
} finally { await browser.close(); stop(child); }
