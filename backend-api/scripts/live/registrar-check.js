#!/usr/bin/env node
'use strict';
/**
 * R1.3: READ-ONLY registrar check. It looks at which ResellerClub settings exist (the saved integration settings, then the server environment), then makes ONE harmless availability read for a fixed name and
 * prints PASS or the honest state: NOT_CONFIGURED, ACCESS_DENIED (the IP is probably not whitelisted yet), REJECTED (the key), TIMEOUT or UNREACHABLE. It writes nothing, buys nothing, and never prints a key,
 * a reseller id or a connection string. It refuses any database that is not the live one (a staging, test or local database, or a placeholder), like the other live scripts, and has no staging mode.
 *
 *   node scripts/live/registrar-check.js        (export the live environment first; PLATFORM_SETTINGS_KEY must be the live one so the saved keys can be read)
 *
 * Needs `npm run build` first. Run it from the server whose IP address ResellerClub has whitelisted: the result is about THIS machine's address.
 */
const path = require('path');
const { liveSeedEnv } = require('./live-env-lib');
const { checkRegistrar } = require('./registrar-check-lib');

const BACKEND = path.resolve(__dirname, '..', '..');

(async () => {
  if (process.argv.length > 2) { console.error('CHECK REFUSED: this script takes no arguments.'); process.exitCode = 2; return; }
  const dist = (p) => require(path.join(BACKEND, 'dist/src', p));
  const live = liveSeedEnv(process.env, dist('common/startup-check').checkDatabaseUrls);
  if (!live.ok) { console.error(`CHECK REFUSED: ${live.problems.join('; ')}.`); process.exitCode = 3; return; }
  const { PrismaClient } = require(path.join(BACKEND, 'node_modules/@prisma/client'));
  const prisma = new PrismaClient({ datasourceUrl: live.DATABASE_URL, log: [] });
  try {
    const { IntegrationSettingsService } = dist('v3-integrations/integration-settings.service');
    const { ResellerClubAdapter, FetchHttp } = dist('v3-registrar/resellerclub.adapter');
    const { liveFlags } = dist('v3-registrar/core/registrar-core');
    const settings = new IntegrationSettingsService(prisma, { probe: async () => 'UNKNOWN' });
    const status = await settings.statusOf('resellerclub');
    const adapter = new ResellerClubAdapter(new FetchHttp(() => process.env, 15000), () => process.env, async () => {
      const v = await settings.resolve('resellerclub');
      return v ? { userId: v.resellerId, apiKey: v.apiKey, mode: v.mode === 'live' ? 'live' : 'demo' } : null;
    });
    const r = await checkRegistrar({
      facts: { status, envKeys: !!(process.env.RESELLERCLUB_AUTH_USERID && process.env.RESELLERCLUB_API_KEY), flagOn: liveFlags(process.env).search },
      search: (sld, tlds) => adapter.search(sld, tlds),
    });
    console.log('Registrar check, LIVE database, read only');
    console.log(r.lines.join('\n'));
    if (!r.pass) process.exitCode = 1;
  } catch (e) {
    console.error('ERROR:', live.mask(String(e && e.message)).split('\n').slice(-2).join(' | '));
    process.exitCode = 1;
  } finally { await prisma.$disconnect(); }
})();
