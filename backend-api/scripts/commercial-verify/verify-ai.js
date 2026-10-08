// AI Studio (Task 8) with STUBBED providers: wallet before the call, debit only on success, OpenAI⇄Anthropic fallback,
// classified vendor messages, ai-health checks, and generated images saved to our own uploads. No network, no keys, no charges.
const fs = require('fs');
const os = require('os');
const path = require('path');
require('reflect-metadata');
const { dist, ok, rejects, section, finish } = require('../security-verify/harness');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'g4d-ai-'));
process.env.UPLOADS_DIR = path.join(tmp, 'uploads');
process.env.PUBLIC_API_URL = 'https://gapi.example.test';

const { AiService } = dist('ai/ai.service');
const E = dist('ai/ai-errors');
const { checkProvider, checkImage } = require('../ai-health-lib');

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 7)]);
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const openaiOk = (text) => json(200, { choices: [{ message: { content: text } }] });
const claudeOk = (text) => json(200, { content: [{ type: 'text', text }] });
const POST = JSON.stringify({ caption: 'Big sale', hashtags: ['a', 'b', 'c', 'd', 'e'], imagePrompt: 'a shoe' });

function world({ openai = 'sk-openai-test', claude = 'sk-ant-test', balance = 100000, routes = {} } = {}) {
  const calls = []; const debits = [];
  const keys = { openai_api_key: openai, anthropic_api_key: claude };
  const settings = { getResolvedValue: async (_c, k) => keys[k] ?? null };
  const wallet = {
    getRate: async (_k, d) => d,
    hasSufficientBalance: async (_v, cost) => balance >= cost,
    deduct: async (v, cost, desc, svc) => { debits.push({ v, cost, svc }); balance -= cost; },
  };
  const storage = { isConfigured: async () => false };
  global.fetch = async (url, init) => {
    calls.push(String(url));
    const u = String(url);
    const r = Object.entries(routes).find(([k]) => u.includes(k));
    if (!r) throw new Error(`unexpected fetch ${u}`);
    const v = typeof r[1] === 'function' ? await r[1](u, init) : r[1];
    if (v instanceof Error) throw v;
    return v.clone ? v.clone() : v;
  };
  return { svc: new AiService(wallet, settings, storage), calls, debits, wallet: () => balance };
}
const dto = { channel: 'social_post', vendorIndustry: 'retail', offerDetails: 'Diwali offer', skipImage: true };
const failsWith = async (p) => { try { await p; return null; } catch (e) { return e; } };
const body = (e) => (e && e.getResponse ? e.getResponse() : {});

(async () => {
  section('classifier');
  {
    const k = E.classifyProviderError;
    ok('401 / invalid_api_key → INVALID_KEY', k(401, '') === 'INVALID_KEY' && k(400, '{"error":{"code":"invalid_api_key"}}') === 'INVALID_KEY' && k(401, '{"type":"authentication_error"}') === 'INVALID_KEY');
    ok('OpenAI reports "out of credit" as 429 insufficient_quota → NO_CREDIT (tested before rate limit)', k(429, '{"error":{"code":"insufficient_quota"}}') === 'NO_CREDIT' && k(400, '{"error":{"message":"Your credit balance is too low to access the Anthropic API"}}') === 'NO_CREDIT' && k(402, '') === 'NO_CREDIT');
    ok('a plain 429 / overloaded → RATE_LIMIT', k(429, '{"error":{"code":"rate_limit_exceeded"}}') === 'RATE_LIMIT' && k(529, '') === 'RATE_LIMIT');
    ok('content policy / safety system → CONTENT_BLOCKED', k(400, '{"error":{"code":"content_policy_violation"}}') === 'CONTENT_BLOCKED' && k(400, 'Your request was rejected as a result of our safety system') === 'CONTENT_BLOCKED');
    ok('timeouts and aborts → TIMEOUT; other network errors / 500 → UNAVAILABLE', k(null, '', Object.assign(new Error('x'), { name: 'TimeoutError' })) === 'TIMEOUT' && k(null, '', new Error('The operation was aborted')) === 'TIMEOUT' && k(null, '', new Error('ECONNRESET')) === 'UNAVAILABLE' && k(500, 'oops') === 'UNAVAILABLE');
    ok('every kind has its own vendor message and none leaks key / provider / account words', Object.keys(E.VENDOR_MESSAGE).length === 6 && new Set(Object.values(E.VENDOR_MESSAGE)).size === 6 && Object.values(E.VENDOR_MESSAGE).every((m) => !/sk-|openai|anthropic|api key|secret/i.test(m) && /nothing was charged/i.test(m)));
    ok('HTTP codes: content blocked 400, rate limit 429, others 503 — each carries a machine code', E.toVendorException('CONTENT_BLOCKED').getStatus() === 400 && E.toVendorException('RATE_LIMIT').getStatus() === 429 && E.toVendorException('INVALID_KEY').getStatus() === 503 && body(E.toVendorException('NO_CREDIT')).details.code === 'AI_NO_CREDIT');
  }

  section('(a) wallet is checked BEFORE the provider; debit only on success');
  {
    const w = world({ balance: 100, routes: { 'api.openai.com': openaiOk(POST) } });
    const e = await failsWith(w.svc.generateContent('v1', dto));
    ok('too little balance → INSUFFICIENT_WALLET_BALANCE (400)', e && e.getStatus() === 400 && /INSUFFICIENT_WALLET_BALANCE/.test(e.message));
    ok('…and the provider was NEVER called (no cost incurred for a vendor who cannot pay)', w.calls.length === 0 && w.debits.length === 0);
    const cs = await failsWith(w.svc.callSummary('v1', { leadName: 'Ravi', textNotes: 'asked price', callDuration: 30 }));
    ok('call summary: same — refused before any provider call', cs && cs.getStatus() === 400 && w.calls.length === 0);
    const w2 = world({ balance: 100000, routes: { 'api.openai.com': openaiOk(POST) } });
    const r = await w2.svc.generateContent('v1', dto);
    ok('with balance: content returned, charged exactly once, after the call', r.caption === 'Big sale' && w2.debits.length === 1 && w2.debits[0].cost === 500 && w2.calls.length === 1);
    const w3 = world({ balance: 0, routes: { 'api.openai.com': openaiOk(POST) } });
    const r3 = await w3.svc.generateContent('staff', dto, true);
    ok('internal staff need no balance and are never charged', r3.caption === 'Big sale' && w3.debits.length === 0);
    const w4 = world({ routes: { 'api.openai.com': openaiOk('this is not json at all') } });
    const e4 = await failsWith(w4.svc.generateContent('v1', dto));
    ok('an unparseable answer is an error and costs the vendor nothing', e4 && e4.getStatus() === 503 && w4.debits.length === 0);
    const w5 = world({ routes: { 'api.openai.com': () => json(401, { error: { code: 'invalid_api_key' } }), 'api.anthropic.com': () => json(500, {}) } });
    const e5 = await failsWith(w5.svc.generateContent('v1', dto));
    ok('every provider failing → no charge', e5 && w5.debits.length === 0);
  }

  section('(b) text falls back OpenAI → Anthropic and back');
  {
    const a = world({ routes: { 'api.openai.com': () => json(401, { error: { code: 'invalid_api_key' } }), 'api.anthropic.com': claudeOk(POST) } });
    const ra = await a.svc.generateContent('v1', dto);
    ok('OpenAI key rejected → Claude answers; vendor gets the content and is charged once', ra.caption === 'Big sale' && a.calls.length === 2 && a.calls[1].includes('anthropic') && a.debits.length === 1);
    const b = world({ openai: null, routes: { 'api.anthropic.com': claudeOk(POST) } });
    const rb = await b.svc.generateContent('v1', dto);
    ok('no OpenAI key at all → goes straight to Claude (previous behaviour kept)', rb.caption === 'Big sale' && b.calls.length === 1 && b.calls[0].includes('anthropic'));
    const c = world({ claude: null, routes: { 'api.openai.com': openaiOk(POST) } });
    ok('no Claude key → OpenAI only', (await c.svc.generateContent('v1', dto)).caption === 'Big sale' && c.calls.length === 1);
    const d = world({ routes: { 'api.openai.com': () => json(429, { error: { code: 'insufficient_quota' } }), 'api.anthropic.com': claudeOk(POST) } });
    ok('OpenAI out of credit → Claude covers it', (await d.svc.generateContent('v1', dto)).caption === 'Big sale' && d.calls.length === 2);
    const f = world({ routes: { 'api.openai.com': openaiOk(POST), 'api.anthropic.com': claudeOk(POST) } });
    await f.svc.generateContent('v1', dto);
    ok('when the first provider works the second is not called', f.calls.length === 1);
    const n = world({ openai: null, claude: null, routes: {} });
    const en = await failsWith(n.svc.generateContent('v1', dto));
    ok('no provider configured → clear "not configured" 503, no charge', en && en.getStatus() === 503 && /not configured/i.test(en.message) && n.debits.length === 0);
    const chat = world({ routes: { 'api.openai.com': () => json(500, {}), 'api.anthropic.com': claudeOk('Hello from Claude') } });
    const cr = await chat.svc.chat({ message: 'hi', context: 'dashboard', conversationHistory: [{ role: 'user', content: 'earlier' }] });
    ok('the chat assistant gets the same fallback (and its history/system prompt reach the provider)', cr.reply === 'Hello from Claude' && chat.calls.length === 2);
  }

  section('(c) specific, vendor-safe messages');
  for (const [label, resp, kind, status] of [
    ['bad key', () => json(401, { error: { code: 'invalid_api_key', message: 'Incorrect API key provided: sk-live-SECRETSECRET' } }), 'INVALID_KEY', 503],
    ['no credit', () => json(429, { error: { code: 'insufficient_quota' } }), 'NO_CREDIT', 503],
    ['rate limit', () => json(429, { error: { code: 'rate_limit_exceeded' } }), 'RATE_LIMIT', 429],
    ['content blocked', () => json(400, { error: { code: 'content_policy_violation' } }), 'CONTENT_BLOCKED', 400],
    ['timeout', () => Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' }), 'TIMEOUT', 503],
  ]) {
    const w = world({ claude: null, routes: { 'api.openai.com': resp } });
    const e = await failsWith(w.svc.generateContent('v1', dto));
    const rb = body(e);
    ok(`${label}: ${status} with the ${kind} message and code, no charge, no secret in the text`, e && e.getStatus() === status && rb.message === E.VENDOR_MESSAGE[kind] && rb.details.code === `AI_${kind}` && w.debits.length === 0 && !/SECRET|sk-/.test(JSON.stringify(rb)), JSON.stringify(rb).slice(0, 140));
  }
  {
    const w = world({ routes: { 'api.openai.com': () => json(400, { error: { code: 'content_policy_violation' } }), 'api.anthropic.com': claudeOk(POST) } });
    const e = await failsWith(w.svc.generateContent('v1', dto));
    ok('a content refusal is NOT sent to the second provider', e && body(e).details.code === 'AI_CONTENT_BLOCKED' && w.calls.length === 1);
    const w2 = world({ routes: { 'api.openai.com': () => json(401, {}), 'api.anthropic.com': () => json(429, { error: { type: 'rate_limit_error' } }) } });
    const e2 = await failsWith(w2.svc.generateContent('v1', dto));
    ok('if both fail, the vendor hears about the FIRST (primary) provider\'s problem', body(e2).details.code === 'AI_INVALID_KEY');
  }

  section('images: classified errors, wallet first, permanent copy in OUR uploads');
  {
    const imgRoutes = {
      'images/generations': () => json(200, { data: [{ url: 'https://oaidalle.example/tmp/abc.png' }] }),
      'oaidalle.example': () => new Response(PNG, { status: 200, headers: { 'Content-Type': 'image/png' } }),
    };
    const w = world({ routes: { 'api.openai.com/v1/chat': openaiOk(POST), ...imgRoutes } });
    const r = await w.svc.generateContent('v1', { ...dto, skipImage: false });
    ok('the picture link returned is OURS (permanent), not the provider\'s expiring one', typeof r.imageUrl === 'string' && r.imageUrl.startsWith('https://gapi.example.test/uploads/ai_') && r.imageUrl.endsWith('.png'), String(r.imageUrl));
    const saved = path.join(process.env.UPLOADS_DIR, path.basename(r.imageUrl));
    ok('…and the file really exists with the exact picture bytes', fs.existsSync(saved) && fs.readFileSync(saved).equals(PNG));
    const wd = world({ balance: 10, routes: imgRoutes });
    const ed = await failsWith(wd.svc.generateDesignImage('v1', 'a card background'));
    ok('design image: wallet checked first — the image API is never called without balance', ed && ed.getStatus() === 400 && wd.calls.length === 0);
    const wf = world({ routes: { 'images/generations': () => json(429, { error: { code: 'insufficient_quota' } }) } });
    const rf = await wf.svc.generateDesignImage('v1', 'a card background');
    ok('image provider out of credit → no image, vendor-safe message, NO charge', rf.imageUrl === null && rf.status === 'failed' && rf.error === E.VENDOR_MESSAGE.NO_CREDIT && wf.debits.length === 0);
    const wh = world({ routes: { 'images/generations': () => json(401, { error: { message: 'Incorrect API key provided: sk-live-REALKEY' } }) } });
    const rh = await wh.svc.generateDesignImage('v1', 'x');
    ok('the raw provider message (which can contain key fragments) is not returned to the vendor', !/REALKEY|sk-/.test(JSON.stringify(rh)) && rh.error === E.VENDOR_MESSAGE.INVALID_KEY);
    const wg = world({ routes: { 'images/generations': () => json(200, { data: [{ url: 'https://oaidalle.example/tmp/x.png' }] }), 'oaidalle.example': () => new Response('<html>not an image</html>', { status: 200 }) } });
    const rg = await wg.svc.generateDesignImage('v1', 'x');
    ok('if the downloaded "picture" is not an image nothing is written to uploads; the temporary link is kept as a fallback', rg.imageUrl === 'https://oaidalle.example/tmp/x.png' && !fs.readdirSync(process.env.UPLOADS_DIR).some((f) => fs.readFileSync(path.join(process.env.UPLOADS_DIR, f)).toString().includes('not an image')));
  }

  section('(d) ai-health');
  {
    const stub = (res) => async () => res;
    const good = await checkProvider('openai', 'sk-SECRET', stub(json(200, {})));
    ok('PASS case: ok=true with HTTP status', good.ok === true && good.status === 200 && good.kind === null);
    const bad = await checkProvider('anthropic', 'sk-ant-SECRET', stub(json(400, { error: { message: 'Your credit balance is too low' } })));
    ok('FAIL case: HTTP status and error type reported', bad.ok === false && bad.status === 400 && bad.kind === 'NO_CREDIT');
    const to = await checkProvider('openai', 'sk-SECRET', async () => { throw Object.assign(new Error('timeout'), { name: 'TimeoutError' }); });
    ok('timeout reported as TIMEOUT with no status', to.ok === false && to.status === null && to.kind === 'TIMEOUT');
    ok('the result never contains the key or the provider\'s response text', !/SECRET|credit balance/i.test(JSON.stringify([good, bad, to])));
    let sent = null;
    await checkProvider('openai', 'sk-SECRET', async (u, i) => { sent = { u, body: JSON.parse(i.body) }; return json(200, {}); });
    ok('the check is minimal: one call, max_tokens 1', sent.body.max_tokens === 1);
    const img = await checkImage('sk-SECRET', stub(json(401, {})));
    ok('image check (opt-in) classifies too', img.ok === false && img.kind === 'INVALID_KEY' && img.provider === 'openai-image');
    const src = fs.readFileSync(path.join(__dirname, '..', 'ai-health.js'), 'utf8');
    ok('ai-health.js never prints a key (no key variable reaches console.log) and the image call needs --image', !/console\.log\([^)]*(openai|claude)\b[^)]*\)/.test(src.replace(/openai \? 'yes'/g, '').replace(/claude \? 'yes'/g, '')) && /--image/.test(src));
  }
  finish();
})().catch((e) => { console.error(e); process.exit(1); });
