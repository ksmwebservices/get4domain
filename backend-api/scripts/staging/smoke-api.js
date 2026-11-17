/* Starts the built API (dist/src/main) on the STAGING database for the front-end smoke tests. STAGING ONLY, through the staging guard.
 *
 *   node scripts/staging/smoke-api.js [--port 3008] [--origins http://localhost:5173,http://localhost:5174,...]
 *   Stop it with Ctrl+C in its window (it stops the API with it).
 *
 * The API runs with: payment gateways OFF (no provider key, PLAN_PAYMENTS_LIVE_ENABLED=false), mail captured (EMAIL_MODE=test), the schedulers off, a random JWT secret made now (not printed),
 * strict CORS naming the dev origins. Every provider variable is removed from its environment. It refuses to start when .env.local or .env exists in the backend folder (the app would load it).
 * Build first:  npm.cmd run build
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const lib = require('./smoke-lib');
const { loadStagingEnv } = require('./guard');

const BACKEND = path.resolve(__dirname, '../..');
const MAIN = path.join(BACKEND, 'dist/src/main.js');

function main() {
  const args = lib.parseApiArgs(process.argv.slice(2));
  if (args.error) { console.error(`SMOKE API REFUSED: ${args.error}`); process.exit(2); }
  const existingEnvFiles = ['.env.local', '.env'].filter((f) => fs.existsSync(path.join(BACKEND, f)));
  const early = lib.apiRefusal({ stagingGuardPassed: true, env: process.env, existingEnvFiles });
  if (early) { console.error(`SMOKE API REFUSED: ${early}`); process.exit(2); }
  if (!fs.existsSync(MAIN)) { console.error('SMOKE API: dist/src/main.js not found. Run: npm.cmd run build'); process.exit(2); }
  const staging = loadStagingEnv();                       // exits (code 3) unless this is the allow-listed staging project
  const jwtSecret = crypto.randomBytes(32).toString('hex');
  const env = lib.buildApiEnv({ parentEnv: process.env, staging, port: args.port, origins: args.origins, jwtSecret });
  const secrets = [jwtSecret, staging.DATABASE_URL, staging.DIRECT_URL, staging.PLATFORM_SETTINGS_KEY].filter(Boolean);
  const scrub = (text) => staging.mask(lib.redact(text, secrets));
  console.log(`starting the API on http://localhost:${args.port} against STAGING; gateways off, mail captured, origins: ${args.origins.join(', ')}`);
  console.log(`environment names set: ${lib.API_ENV_NAMES.join(', ')} (values are never printed)`);
  const child = spawn(process.execPath, [MAIN], { cwd: BACKEND, env, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (d) => process.stdout.write(scrub(d.toString())));
  child.stderr.on('data', (d) => process.stderr.write(scrub(d.toString())));
  const stop = () => { if (!child.killed) child.kill(); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop); process.on('exit', stop);
  child.on('exit', (code) => { console.log(`API stopped (exit ${code ?? 'signal'}).`); process.exit(code ?? 0); });
}

if (require.main === module) main();
