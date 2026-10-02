// FIX 6: the GLOBAL defaults (300 writes/min, 1500 reads/min per IP) apply to routes with no specific limit,
// per-route buckets are independent, trusted IPs and the THROTTLE_DISABLED emergency switch work.
// Uses the real shared throttling config.
const { dist, ok, section, finish } = require('./harness');
const { Controller, Get, Post, Module } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const { throttlerImport, throttlerGuardProvider, GLOBAL_LIMIT, READ_LIMIT } = dist('common/throttling');

class Probe { a() { return 'a'; } w() { return 'w'; } w2() { return 'w2'; } }
Controller('probe')(Probe);
Get('a')(Probe.prototype, 'a', Object.getOwnPropertyDescriptor(Probe.prototype, 'a'));
Post('w')(Probe.prototype, 'w', Object.getOwnPropertyDescriptor(Probe.prototype, 'w'));
Post('w2')(Probe.prototype, 'w2', Object.getOwnPropertyDescriptor(Probe.prototype, 'w2'));
class TestModule {}
Module({ imports: [throttlerImport], controllers: [Probe], providers: [throttlerGuardProvider] })(TestModule);

async function boot() {
  const app = await NestFactory.create(TestModule, { logger: false });
  await app.listen(0);
  return { app, base: (await app.getUrl()).replace('[::1]', 'localhost') };
}
const burst = async (n, fn, c = 40) => { const out = []; let i = 0; await Promise.all(Array.from({ length: c }, async () => { while (i < n) { const k = i++; out[k] = await fn(); } })); return out; };

(async () => {
  section(`FIX 6 — global defaults (writes ${GLOBAL_LIMIT.limit}/min, reads ${READ_LIMIT.limit}/min, per client IP)`);
  const { app, base } = await boot();
  const postW = async () => (await fetch(`${base}/probe/w`, { method: 'POST' })).status;
  const getA = async () => (await fetch(`${base}/probe/a`)).status;

  let st = await burst(GLOBAL_LIMIT.limit + 5, postW);
  ok(`write route (no specific limit): ${st.filter((s) => s === 201).length} × 201 then ${st.filter((s) => s === 429).length} × 429`, st.filter((s) => s === 201).length === GLOBAL_LIMIT.limit && st.filter((s) => s === 429).length === 5);
  ok('a different write route has its own bucket (still allowed)', (await (await fetch(`${base}/probe/w2`, { method: 'POST' })).status) === 201);
  st = await burst(GLOBAL_LIMIT.limit + 50, getA);
  ok(`reads are NOT limited at the write threshold (${GLOBAL_LIMIT.limit + 50} reads all 200)`, st.every((s) => s === 200));
  st = await burst(READ_LIMIT.limit + 5, getA);
  // the 350 reads above already used part of this route's read bucket
  const used = GLOBAL_LIMIT.limit + 50;
  ok(`reads are still capped: bucket of ${READ_LIMIT.limit}/min exhausted → 429 afterwards (${st.filter((s) => s === 429).length} × 429)`, st.filter((s) => s === 200).length === READ_LIMIT.limit - used && st.filter((s) => s === 429).length === 5 + used);
  await app.close();

  section('FIX 6 — trusted IPs and the emergency switch');
  process.env.THROTTLE_TRUSTED_IPS = '::1,::ffff:127.0.0.1,127.0.0.1';
  let b = await boot();
  st = await burst(GLOBAL_LIMIT.limit + 20, async () => (await fetch(`${b.base}/probe/w`, { method: 'POST' })).status);
  ok('a THROTTLE_TRUSTED_IPS address is never limited', st.every((s) => s === 201));
  await b.app.close();
  delete process.env.THROTTLE_TRUSTED_IPS;

  process.env.THROTTLE_DISABLED = 'true';
  b = await boot();
  st = await burst(GLOBAL_LIMIT.limit + 20, async () => (await fetch(`${b.base}/probe/w`, { method: 'POST' })).status);
  ok('THROTTLE_DISABLED=true disables limiting without a code change', st.every((s) => s === 201));
  await b.app.close();
  delete process.env.THROTTLE_DISABLED;
  finish();
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(2); });
