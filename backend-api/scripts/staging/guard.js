/* Staging guard — every db:staging:* command and the Jest global setup go through this.
 * Refuses to return a connection unless its Supabase project ref is on the staging allow-list
 * AND is not on the production deny-list (both stored as SHA-256 hashes, never as URLs).
 * Credentials are never printed: use mask() on anything that might contain them.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO_ROOT = path.resolve(__dirname, '../../..');
const CONFIG = path.join(__dirname, 'staging-guard.config.json');
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

function parseEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(
    fs.readFileSync(file, 'utf8').split(/\r?\n/).filter((l) => /^[A-Za-z_]\w*=/.test(l))
      .map((l) => [l.split('=')[0], l.slice(l.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '')]),
  );
}

function projectRef(urlString) {
  let u;
  try { u = new URL(urlString); } catch { return null; }
  if (u.username.includes('.')) return u.username.split('.').slice(1).join('.');
  const m = u.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/);
  return m ? m[1] : null;
}

function secretsOf(urls) {
  const out = [];
  for (const s of urls) {
    if (!s) continue;
    out.push(s);
    try {
      const u = new URL(s);
      [u.password, safeDecode(u.password), u.username, u.hostname].forEach((x) => x && out.push(x));
    } catch { /* masked as a whole */ }
  }
  return [...new Set(out)].sort((a, b) => b.length - a.length);
}
const safeDecode = (x) => { try { return decodeURIComponent(x); } catch { return x; } };

function maskWith(secrets) {
  return (text) => secrets.reduce((acc, s) => acc.split(s).join('***'), String(text));
}

/** Returns { DATABASE_URL, DIRECT_URL, mask } or exits with a refusal. Never prints URLs. */
function loadStagingEnv() {
  const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  const file = parseEnvFile(path.join(REPO_ROOT, '.env.staging'));
  const DATABASE_URL = process.env.STAGING_DATABASE_URL || file.DATABASE_URL;
  const DIRECT_URL = process.env.STAGING_DIRECT_URL || file.DIRECT_URL;
  const mask = maskWith(secretsOf([DATABASE_URL, DIRECT_URL]));
  const refuse = (why) => { console.error(`STAGING GUARD REFUSED: ${why}`); process.exit(3); };

  if (!DATABASE_URL || !DIRECT_URL) refuse('staging DATABASE_URL / DIRECT_URL not found (.env.staging or STAGING_* env).');
  for (const [name, url] of [['DATABASE_URL', DATABASE_URL], ['DIRECT_URL', DIRECT_URL]]) {
    const ref = projectRef(url);
    if (!ref) refuse(`${name}: cannot determine the Supabase project ref.`);
    const h = sha(ref);
    if (cfg.deniedProjectRefHashes.includes(h)) refuse(`${name} points at a DENIED (production) project.`);
    if (!cfg.allowedProjectRefHashes.includes(h)) refuse(`${name} is not on the staging allow-list.`);
  }
  return { DATABASE_URL, DIRECT_URL, mask, /** optional: the key that seals credentials in tests (staging only; never the production key) */ PLATFORM_SETTINGS_KEY: process.env.STAGING_PLATFORM_SETTINGS_KEY || file.PLATFORM_SETTINGS_KEY };
}

module.exports = { loadStagingEnv, projectRef, sha, parseEnvFile, secretsOf, maskWith, REPO_ROOT, CONFIG };
