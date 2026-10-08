// Custom-domain readiness (CORS): the helper's rules, then the real Nest/Express CORS headers in both modes.
require('reflect-metadata');
const { dist, ok, section, finish } = require('../security-verify/harness');
const { buildCorsOptions, parseExtraOrigins } = dist('common/cors');
const { NestFactory } = require('@nestjs/core');
const { Module, Controller, Get } = require('@nestjs/common');

const decide = (opts, origin) => new Promise((resolve) => {
  if (opts.origin === true) return resolve(true);
  opts.origin(origin, (_err, allow) => resolve(Boolean(allow)));
});

(async () => {
  section('parseExtraOrigins');
  const p = parseExtraOrigins(' https://Shop.Example/ , stepnrock.in,,http://dev.local:3000/ ,stepnrock.in');
  ok('trims, lower-cases, strips trailing slashes, de-duplicates; a bare host means https', JSON.stringify(p) === JSON.stringify(['https://shop.example', 'https://stepnrock.in', 'http://dev.local:3000']), JSON.stringify(p));
  ok('empty / undefined → no origins', parseExtraOrigins('').length === 0 && parseExtraOrigins(undefined).length === 0);

  section('open mode (today\'s production behaviour): a custom domain works with no change');
  const open = buildCorsOptions({});
  ok('every browser origin is reflected — including a brand-new custom domain', (await decide(open, 'https://www.stepnrock.in')) && (await decide(open, 'https://anything.example')));
  ok('credentials stay on', open.credentials === true);

  section('strict mode: platform + CORS_EXTRA_ORIGINS only');
  const strict = buildCorsOptions({ CORS_MODE: 'strict', CORS_EXTRA_ORIGINS: 'https://stepnrock.in, shop.example', FRONTEND_URL: 'https://get4domain.com' });
  ok('the platform and its subdomains are allowed', (await decide(strict, 'https://get4domain.com')) && (await decide(strict, 'https://stepnrock.get4domain.com')) && (await decide(strict, 'https://gapi.get4domain.com')));
  ok('local development origins are allowed', (await decide(strict, 'http://localhost:3000')) && (await decide(strict, 'http://127.0.0.1:3015')));
  ok('the vendor\'s custom domain is allowed — apex AND www, from one entry', (await decide(strict, 'https://stepnrock.in')) && (await decide(strict, 'https://www.stepnrock.in')));
  ok('a bare-host entry works the same (shop.example → https://shop.example and www)', (await decide(strict, 'https://shop.example')) && (await decide(strict, 'https://www.shop.example')));
  ok('matching ignores case and a trailing slash', (await decide(strict, 'HTTPS://StepNRock.IN/')));
  ok('an unlisted origin is refused', !(await decide(strict, 'https://evil.example')));
  ok('look-alikes are refused (suffix/prefix tricks, other scheme, the literal "null" origin)', !(await decide(strict, 'https://stepnrock.in.evil.example')) && !(await decide(strict, 'https://evilget4domain.com')) && !(await decide(strict, 'https://get4domain.com.evil.example')) && !(await decide(strict, 'http://stepnrock.in')) && !(await decide(strict, 'null')));
  ok('server-to-server requests (no Origin header) are allowed', await decide(strict, undefined));
  ok('with no extras configured, a custom domain is refused until it is added (the env var is what grants it)', !(await decide(buildCorsOptions({ CORS_MODE: 'strict' }), 'https://stepnrock.in')));

  section('real HTTP headers (Express through Nest)');
  class Ping { ping() { return { ok: true }; } }
  Controller('ping')(Ping);
  Get()(Ping.prototype, 'ping', Object.getOwnPropertyDescriptor(Ping.prototype, 'ping'));
  class M {}
  Module({ controllers: [Ping] })(M);
  const serve = async (env) => {
    const app = await NestFactory.create(M, { logger: false });
    app.enableCors(buildCorsOptions(env));
    await app.listen(0, '127.0.0.1');
    return { app, base: `http://127.0.0.1:${app.getHttpServer().address().port}` };
  };
  const probe = async (base, origin) => {
    const r = await fetch(`${base}/ping`, { headers: { Origin: origin } });
    const pre = await fetch(`${base}/ping`, { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type' } });
    return { allow: r.headers.get('access-control-allow-origin'), preAllow: pre.headers.get('access-control-allow-origin'), preStatus: pre.status };
  };
  const a = await serve({});
  const ra = await probe(a.base, 'https://www.stepnrock.in');
  ok('open mode: the custom domain gets Access-Control-Allow-Origin and a successful preflight', ra.allow === 'https://www.stepnrock.in' && ra.preAllow === 'https://www.stepnrock.in' && ra.preStatus < 300, JSON.stringify(ra));
  await a.app.close();
  const b = await serve({ CORS_MODE: 'strict', CORS_EXTRA_ORIGINS: 'stepnrock.in' });
  const rb = await probe(b.base, 'https://www.stepnrock.in');
  const rbad = await probe(b.base, 'https://evil.example');
  ok('strict mode + CORS_EXTRA_ORIGINS=stepnrock.in: www.stepnrock.in is allowed (header + preflight)', rb.allow === 'https://www.stepnrock.in' && rb.preAllow === 'https://www.stepnrock.in', JSON.stringify(rb));
  ok('strict mode: an unlisted origin gets NO Access-Control-Allow-Origin', rbad.allow === null && rbad.preAllow === null, JSON.stringify(rbad));
  await b.app.close();
  finish();
})().catch((e) => { console.error(e); process.exit(1); });
