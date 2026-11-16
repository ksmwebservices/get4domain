'use strict';
/** The pure parts of the live seed runner (job L6). */

/** The loaders that may be run against the live database. A new seed-v3-*.js loader must be added here on purpose (a test fails until it is). */
const SEED_SCRIPTS = [
  'seed-v3-plans.js', 'seed-v3-wallet-settings.js', 'seed-v3-pay-settings.js', 'seed-v3-services.js', 'seed-v3-terms.js', 'seed-v3-alert-rules.js', 'seed-v3-mail-rules.js',
  'seed-v3-directory.js', 'seed-v3-pack-engine.js', 'seed-v3-pack-tab-fields.js', 'seed-v3-profile-fields.js', 'seed-v3-catalogue-categories.js',
  'seo-category-keywords-load.js', 'banner-library-load.js',
];

const secretsOf = (urls) => {
  const out = [];
  for (const s of urls) {
    if (!s) continue;
    out.push(s);
    try { const u = new URL(s); [u.password, decodeURIComponent(u.password), u.username, u.hostname].forEach((x) => x && out.push(x)); } catch { /* masked whole */ }
  }
  return [...new Set(out)].sort((a, b) => b.length - a.length);
};

/** The live connection for a seed run, after the live API's own refusals (a staging, test or local database, a placeholder), or the problems in words that never repeat a value. */
function liveSeedEnv(env, checkDatabaseUrls) {
  const DATABASE_URL = env.DATABASE_URL; const DIRECT_URL = env.DIRECT_URL;
  const problems = checkDatabaseUrls({ DATABASE_URL, DIRECT_URL }).map((p) => `${p.name} ${p.problem}`);
  if (problems.length) return { ok: false, problems };
  const secrets = secretsOf([DATABASE_URL, DIRECT_URL]);
  return { ok: true, DATABASE_URL, DIRECT_URL, mask: (text) => secrets.reduce((acc, s) => acc.split(s).join('***'), String(text)) };
}

/** Only the word LIVE, typed exactly, confirms a write. */
const applyConfirmed = (typed) => typeof typed === 'string' && typed.trim() === 'LIVE';

module.exports = { liveSeedEnv, SEED_SCRIPTS, applyConfirmed, secretsOf };
