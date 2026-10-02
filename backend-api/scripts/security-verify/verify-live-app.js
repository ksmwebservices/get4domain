// FIX 5 + FIX 6 against the REAL compiled application (dist/src/main.js) booted locally.
// Only requests that cannot write anything are sent: invalid/missing signatures, malformed bodies,
// unauthenticated calls and a non-existent subdomain. The only legitimately-signed requests use a
// status event type that the handler acknowledges before doing any work.
// Usage: PORT=3099 node dist/src/main.js   (env from .env.local, plus FAST2SMS_WEBHOOK_SECRET for MODE=secret)
//        MODE=nosecret|secret PORT=3099 node scripts/security-verify/verify-live-app.js
const crypto = require('crypto');
const { ok, section, finish } = require('./harness');

const PORT = process.env.PORT || '3099';
const BASE = `http://localhost:${PORT}`;
const MODE = process.env.MODE || 'nosecret';
const WA_SECRET = process.env.FAST2SMS_WEBHOOK_SECRET; // only set when MODE=secret

async function post(path, { headers = {}, body = {}, raw } = {}) {
  const res = await fetch(BASE + path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: raw ?? JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, text };
}
const burst = async (n, fn, concurrency = 20) => {
  const statuses = [];
  let i = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => { while (i < n) { const k = i++; statuses[k] = (await fn(k)).status; } }));
  return statuses;
};
const count = (arr, s) => arr.filter((x) => x === s).length;

(async () => {
  const health = await fetch(`${BASE}/pricing`).catch(() => null);
  if (!health || !health.ok) { console.error(`App not reachable on ${BASE} — start it first`); process.exit(2); }

  if (MODE === 'nosecret') {
    section('FIX 5 — WhatsApp webhook, NO secret configured (the state right after deploy)');
    let r = await post('/whatsapp-bot/webhook', { body: { webhook_type: 'incoming_message', from: '919999999999', body: 'hi', message_type: 'text' } });
    ok('no header, no secret configured → REJECTED (fails closed, was open before)', r.status === 401, `status=${r.status} ${r.text.slice(0, 100)}`);
    r = await post('/whatsapp-bot/webhook', { headers: { webhook_secret_key: 'guess' }, body: { webhook_type: 'incoming_message', from: '919999999999', body: 'hi' } });
    ok('attacker-chosen header while nothing is configured → REJECTED', r.status === 401, `status=${r.status}`);

    section('FIX 5 — Razorpay webhook signature (already HMAC; confirm it still rejects)');
    const body = JSON.stringify({ event: 'noop.event', payload: {} });
    r = await post('/payments/webhook', { raw: body });
    ok('missing signature → rejected', r.status === 400, `status=${r.status}`);
    r = await post('/payments/webhook', { raw: body, headers: { 'x-razorpay-signature': 'a'.repeat(64) } });
    ok('forged signature → rejected', r.status === 400, `status=${r.status}`);
    const whSecret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;
    if (whSecret) {
      r = await post('/payments/webhook', { raw: body, headers: { 'x-razorpay-signature': crypto.createHmac('sha256', whSecret).update(body).digest('hex') } });
      ok('correctly signed (no-op event) → accepted', r.status === 200 || r.status === 201, `status=${r.status}`);
    }

    section('FIX 6 — rate limits on the real routes (unauthenticated floods hit 429 BEFORE the JWT guard)');
    let s = await burst(14, () => post('/auth/login', { body: { email: 'nobody-ratelimit-test@example.invalid', password: 'wrong-password-1' } }), 1);
    ok(`POST /auth/login: first 10 handled (401), then 429 — got ${count(s, 401)}×401, ${count(s, 429)}×429`, count(s, 401) === 10 && count(s, 429) === 4, JSON.stringify(s));

    s = await burst(6, () => post('/otp/request', { body: {} }), 1);
    ok(`POST /otp/request: 3 allowed (400 validation), then 429 — got ${count(s, 400)}×400, ${count(s, 429)}×429`, count(s, 400) === 3 && count(s, 429) === 3, JSON.stringify(s));

    s = await burst(6, () => post('/customer/request-otp', { body: {} }), 1);
    ok(`POST /customer/request-otp: 3 allowed, then 429 — got ${count(s, 429)}×429`, count(s, 429) === 3, JSON.stringify(s));

    s = await burst(24, () => post('/payments/create-order', { body: { invoiceId: 'x' } }), 1);
    ok(`POST /payments/create-order (no auth): 20 × 401, then 429 — got ${count(s, 401)}×401, ${count(s, 429)}×429`, count(s, 401) === 20 && count(s, 429) === 4, JSON.stringify(s));

    s = await burst(24, () => post('/payments/verify', { body: { invoiceId: 'x', razorpayOrderId: 'o', razorpayPaymentId: 'p', razorpaySignature: 's' } }), 1);
    ok(`POST /payments/verify (no auth): 20 × 401, then 429 — got ${count(s, 401)}×401, ${count(s, 429)}×429`, count(s, 401) === 20 && count(s, 429) === 4, JSON.stringify(s));

    s = await burst(24, () => post('/wallet/topup/verify', { body: {} }), 1);
    ok(`POST /wallet/topup/verify: limited at 20 — got ${count(s, 429)}×429`, count(s, 429) === 4, JSON.stringify(s));

    s = await burst(34, () => post('/engine/public/does-not-exist-ratelimit/actions/engine.enquiry', { body: { name: 'a', phone: '1' } }), 1);
    ok(`POST /engine/public/:sub/actions/:intent (checkout/enquiry): 30 allowed, then 429 — got ${count(s, 429)}×429`, count(s, 429) === 4, JSON.stringify(s));

    s = await burst(125, () => post('/payments/webhook', { raw: '{}', headers: { 'x-razorpay-signature': 'bad' } }), 25);
    // 3 earlier calls (missing / forged / valid signature) already used part of this route's 120/min bucket.
    ok(`POST /payments/webhook flood: bucket of 120/min fully used (3 earlier + ${count(s, 400)} here = ${3 + count(s, 400)} handled), the rest 429 — got ${count(s, 429)}×429`, 3 + count(s, 400) === 120 && count(s, 429) === 125 - 117, `400=${count(s, 400)} 429=${count(s, 429)}`);
  }

  if (MODE === 'secret') {
    section('FIX 5 — WhatsApp webhook, secret configured: signature is enforced on every call');
    const ev = { webhook_type: 'status_update', from: '919999999999', body: 'x' }; // acknowledged before any work is done
    let r = await post('/whatsapp-bot/webhook', { body: ev });
    ok('missing signature header → REJECTED', r.status === 401, `status=${r.status}`);
    r = await post('/whatsapp-bot/webhook', { headers: { webhook_secret_key: 'wrong-secret' }, body: ev });
    ok('wrong secret → REJECTED', r.status === 401, `status=${r.status}`);
    r = await post('/whatsapp-bot/webhook', { headers: { webhook_secret_key: WA_SECRET.slice(0, -1) + (WA_SECRET.endsWith('x') ? 'y' : 'x') }, body: ev });
    ok('secret of the SAME length but one character off → REJECTED', r.status === 401, `status=${r.status}`);
    r = await post('/whatsapp-bot/webhook', { headers: { webhook_secret_key: WA_SECRET.slice(0, 5) }, body: ev });
    ok('truncated secret → REJECTED', r.status === 401, `status=${r.status}`);
    r = await post('/whatsapp-bot/webhook', { headers: { webhook_secret_key: WA_SECRET }, body: ev });
    ok('correct secret → ACCEPTED (acknowledged, nothing processed)', r.status === 200 && r.text.includes('ignored'), `status=${r.status} ${r.text.slice(0, 100)}`);

    section('FIX 6 — WhatsApp webhook rate limit (300/min)');
    const s = await burst(305, () => post('/whatsapp-bot/webhook', { headers: { webhook_secret_key: 'wrong' }, body: ev }), 30);
    // 5 earlier calls on this route are already in the 300/min bucket.
    ok(`305 forged calls: ${count(s, 401)}×401 then ${count(s, 429)}×429 (5 earlier + ${count(s, 401)} = 300 handled, limit 300/min)`, 5 + count(s, 401) === 300 && count(s, 429) === 10, `401=${count(s, 401)} 429=${count(s, 429)}`);
  }

  finish();
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(2); });
