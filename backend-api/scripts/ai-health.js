#!/usr/bin/env node
'use strict';
/**
 * AI Studio provider health (handover dispatch 08-Oct-2026, Task 8) — KSM runs this on the VM HOST.
 *
 *   set -a; . ./.env; set +a
 *   node scripts/ai-health.js              # one tiny text call (1 token) per CONFIGURED provider
 *   node scripts/ai-health.js --image      # also generates one real DALL-E picture (costs a few rupees)
 *
 * Prints PASS/FAIL per provider with the HTTP status and the error type (INVALID_KEY, NO_CREDIT, RATE_LIMIT, CONTENT_BLOCKED, TIMEOUT,
 * UNAVAILABLE). Keys are read the same way the app reads them (Admin → Integrations, env fallback) and are NEVER printed.
 * Exit code 1 if any configured provider fails or none is configured. Writes nothing.
 */
const path = require('path');
const fs = require('fs');
const { checkProvider, checkImage } = require('./ai-health-lib');
const dist = (p) => require(path.join(__dirname, '..', 'dist', 'src', p));

if (!process.env.DATABASE_URL) {
  for (const name of ['.env', '.env.local']) {
    const file = path.join(__dirname, '..', name);
    if (!fs.existsSync(file)) continue;
    for (const l of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  }
}

const HINT = {
  INVALID_KEY: 'the key is wrong, revoked or from another account — re-enter it in Admin → Integrations',
  NO_CREDIT: 'the provider account has no credit / has hit its spend limit — add credit in the provider dashboard',
  RATE_LIMIT: 'too many requests right now — usually passes; retry in a minute',
  CONTENT_BLOCKED: 'the provider refused the test prompt',
  TIMEOUT: 'no answer within 20 s — network or provider outage',
  UNAVAILABLE: 'the provider answered with an unexpected error or could not be reached',
};

(async () => {
  if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is not set (run: set -a; . ./.env; set +a).'); process.exit(2); }
  const { PrismaService } = dist('prisma/prisma.service');
  const { PlatformSettingsService } = dist('platform-settings/platform-settings.service');
  const prisma = new PrismaService();
  await prisma.$connect();
  let failed = 0;
  try {
    const settings = new PlatformSettingsService(prisma);
    const openai = await settings.getResolvedValue('ai', 'openai_api_key');
    const claude = await settings.getResolvedValue('ai', 'anthropic_api_key');
    console.log('AI Studio provider health');
    console.log(`  configured: OpenAI ${openai ? 'yes' : 'NO'} · Anthropic ${claude ? 'yes' : 'NO'}`);
    const results = [];
    if (openai) results.push(await checkProvider('openai', openai));
    if (claude) results.push(await checkProvider('anthropic', claude));
    if (process.argv.includes('--image')) {
      if (openai) results.push(await checkImage(openai)); else console.log('  image check skipped: no OpenAI key');
    }
    if (results.length === 0) { console.log('FAIL  no AI provider is configured — AI Studio cannot generate anything.'); failed += 1; }
    for (const r of results) {
      console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.provider.padEnd(13)} HTTP ${r.status ?? '—'}  ${r.ok ? 'ok' : r.kind}  (${r.ms} ms)${r.ok ? '' : `\n      → ${HINT[r.kind]}`}`);
      if (!r.ok) failed += 1;
    }
    const okText = results.filter((r) => r.ok && r.provider !== 'openai-image').length;
    console.log(okText >= 2 ? '\nBoth text providers work — fallback is available.' : okText === 1 ? '\nOne text provider works; there is no fallback if it fails.' : '');
  } finally {
    await prisma.$disconnect();
  }
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e && e.message ? e.message : e); process.exit(1); });
