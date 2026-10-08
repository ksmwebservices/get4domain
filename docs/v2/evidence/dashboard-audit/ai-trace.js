// AI STUDIO TRACE — real compiled AiService + WalletService against the isolated Postgres (PGlite). One real Claude call at most.
const fs = require('fs');
const BE = 'C:/Get4Domain/get4domain-site/backend-api';
for (const l of fs.readFileSync(`${BE}/.env.local`, 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
}
const PG = 'postgresql://postgres:postgres@127.0.0.1:54329/postgres?sslmode=disable&connection_limit=1&pool_timeout=60';
process.env.DATABASE_URL = PG; process.env.DIRECT_URL = PG;
process.env.PLATFORM_SETTINGS_KEY = process.env.PLATFORM_SETTINGS_KEY || 'audit-key-audit-key-audit-key-0123';
for (const k of ['RESEND_API_KEY', 'FAST2SMS_API_KEY', 'OPENAI_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) delete process.env[k];
process.chdir(BE);
require('reflect-metadata');
const { dist } = require(`${BE}/scripts/security-verify/harness`);
const out = [];
const log = (s) => { out.push(s); console.log(s); };
const ok = (n, c, d = '') => log(`${c ? 'PASS' : 'FAIL'}  ${n}${d ? '  → ' + d : ''}`);

(async () => {
  const { NestFactory } = require('@nestjs/core');
  const app = await NestFactory.createApplicationContext(dist('app.module').AppModule, { logger: ['error'] });
  const get = (n, m) => app.get(dist(m)[n], { strict: false });
  const prisma = get('PrismaService', 'prisma/prisma.service');
  const demo = get('DemoService', 'demo/demo.service');
  const ai = get('AiService', 'ai/ai.service');
  const wallet = get('WalletService', 'wallet/wallet.service');

  log('Provider keys visible to this isolated app: CLAUDE_API_KEY=' + (process.env.CLAUDE_API_KEY ? 'set' : 'unset') + ', OPENAI_API_KEY=unset (cleared), DB settings=none (isolated DB)');
  const v = await demo.provisionSandbox('retail', 'AI AUDIT', '9999999990');
  const bal0 = (await prisma.wallet.findUnique({ where: { vendorId: v.id } })).balance;
  log(`sandbox vendor wallet before: ${bal0} paise (trial credit)`);

  log('\n-- A. ONE real text generation (social_post, skipImage) through AiService.generateContent');
  let res = null, err = null;
  try { res = await ai.generateContent(v.id, { channel: 'social_post', vendorIndustry: 'retail', offerDetails: 'Diwali sale on sneakers. Details: 20 percent off this weekend', tone: 'friendly', skipImage: true }); } catch (e) { err = `${e.status || e.getStatus?.() || ''} ${e.message}`; }
  const bal1 = (await prisma.wallet.findUnique({ where: { vendorId: v.id } })).balance;
  const txs = await prisma.walletTransaction.findMany({ where: { vendorId: v.id, service: { startsWith: 'ai_content' } }, select: { service: true, amount: true } });
  if (res) {
    ok('text generation works with a configured provider key', Boolean(res.caption), `caption(${String(res.caption).length} chars), hashtags=${res.hashtags?.length}`);
    ok('wallet debited ONCE, only after the provider returned parseable content', bal0 - bal1 > 0 && txs.length === 1, `${bal0} → ${bal1} (${JSON.stringify(txs)})`);
  } else {
    log(`FAIL  text generation threw: ${err}`);
  }

  log('\n-- B. Ordering with an EMPTY wallet (provider stubbed so no second paid call is made)');
  const v2 = await demo.provisionSandbox('retail', 'AI AUDIT 2', '9999999991');
  await prisma.wallet.update({ where: { vendorId: v2.id }, data: { balance: 0 } });
  let providerCalls = 0;
  const realGen = ai.generateText.bind(ai);
  ai.generateText = async () => { providerCalls += 1; return '{"caption":"c","hashtags":["a","b","c","d","e"],"imagePrompt":"p"}'; };
  let e2 = null;
  try { await ai.generateContent(v2.id, { channel: 'social_post', vendorIndustry: 'retail', offerDetails: 'x', skipImage: true }); } catch (e) { e2 = e.message; }
  ok('EMPTY WALLET: the provider is called FIRST (cost incurred), then the debit fails — there is no balance pre-check in generateContent', providerCalls === 1 && /INSUFFICIENT/i.test(String(e2)), `providerCalls=${providerCalls}, error="${e2}"`);
  ai.generateText = realGen;

  log('\n-- C. Provider fallback behaviour (code-level, stubbed settings)');
  const settings = get('PlatformSettingsService', 'platform-settings/platform-settings.service');
  const origResolve = settings.getResolvedValue.bind(settings);
  let order = [];
  settings.getResolvedValue = async (cat, key) => { order.push(key); return key === 'openai_api_key' ? 'sk-invalid-audit' : (key === 'anthropic_api_key' ? process.env.CLAUDE_API_KEY || null : null); };
  const realFetch = global.fetch; let hit = [];
  global.fetch = async (url, init) => { hit.push(String(url)); if (String(url).includes('openai.com')) return new Response(JSON.stringify({ error: { message: 'Incorrect API key provided' } }), { status: 401 }); return realFetch(url, init); };
  let e3 = null;
  try { await ai.generateText('say hi', 5); } catch (e) { e3 = `${e.status || ''} ${e.message}`; }
  global.fetch = realFetch; settings.getResolvedValue = origResolve;
  ok('IF an OpenAI key is configured but invalid/uncredited, text generation FAILS and does NOT fall back to the working Claude key', Boolean(e3) && hit.every((u) => u.includes('openai.com')), `urls=${hit.join(',')}; error="${e3}"`);

  fs.writeFileSync(`${process.env.TEMP}/audit/ai-trace.out.txt`, out.join('\n'));
  await app.close(); process.exit(0);
})().catch((e) => { console.error('TRACE ERROR', e); fs.writeFileSync(`${process.env.TEMP}/audit/ai-trace.out.txt`, out.join('\n') + '\nTRACE ERROR ' + e.stack); process.exit(1); });
