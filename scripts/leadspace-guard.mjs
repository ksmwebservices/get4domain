#!/usr/bin/env node
// LeadSpace guard (part of `npm run bos:verify`). Static checks that keep the rules of Dispatch B true as the code changes:
//   G1 every admin controller of LeadSpace and the social publisher is behind a guard, and only the three non-money ones may use the staff guard (MARKETING allowed)
//   G2 the common WhatsApp number can only send authentication and utility templates, has no free-text send, and screens promotional words
//   G3 the public controllers are the only ones without a login, and none of them is under an admin path
//   G4 no console.log in LeadSpace, messaging or social code (use the Logger)
//   G5 no typed rupee amount or plan name in the LeadSpace vendor screens (they come from the server)
//   G6 every LeadSpace migration is additive and the RLS script still has its dollar quotes
//   G7 the migration and onboarding scripts are dry-run by default and need --apply to write
//   G8 a seeded violation of each rule is caught (the guard tests itself)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BE = path.join(ROOT, 'backend-api');
const FE = path.join(ROOT, 'get4domain_mvp', 'src');
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const walk = (d, ext, acc = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (!['node_modules', 'dist', '.next'].includes(e.name)) walk(p, ext, acc); } else if (ext.some((x) => e.name.endsWith(x))) acc.push(p); } return acc; };

const problems = [];
const bad = (rule, msg) => problems.push(`${rule} ${msg}`);

/** Controllers in a source text: [{ path, guards, public, name }]. */
export function controllersIn(src) {
  const out = [];
  const re = /((?:@\w+(?:\([^)]*\))?\s*\n)+)export class (\w+Controller)/g;
  for (const m of src.matchAll(re)) {
    const deco = m[1];
    const c = /@Controller\('([^']*)'\)/.exec(deco);
    if (!c) continue;
    out.push({ name: m[2], path: c[1], public: /@Public\(\)/.test(deco), guards: [...deco.matchAll(/@UseGuards\(([^)]*)\)/g)].flatMap((g) => g[1].split(',').map((x) => x.trim())) });
  }
  return out;
}

const STAFF_OK = new Set(['LeadspacePagesAdminController', 'LeadspacePromotionAdminController', 'SocialAdminController']);

export function checkControllers(files) {
  const found = [];
  for (const [file, src] of files) for (const c of controllersIn(src)) found.push({ ...c, file });
  const out = [];
  for (const c of found) {
    if (/^admin\//.test(c.path)) {
      if (c.public) out.push(`G3 ${c.name} is under an admin path but is marked @Public`);
      if (!c.guards.some((g) => /AdminGuard$|StaffGuard$/.test(g))) out.push(`G1 ${c.name} (${c.path}) has no admin guard`);
      if (c.guards.some((g) => /StaffGuard$/.test(g)) && !STAFF_OK.has(c.name)) out.push(`G1 ${c.name} uses the staff guard (MARKETING allowed) but is not one of the reviewed non-money controllers`);
    }
    if (c.public && !/^(leadspace\/public|leadspace\/refill|messaging\/whatsapp)/.test(c.path)) out.push(`G3 ${c.name} (${c.path}) is public but not under a reviewed public path`);
  }
  return out;
}

export function checkGateway(src) {
  const out = [];
  const m = /DEFAULT_TEMPLATES[^=]*=\s*\[([\s\S]*?)\n\];/.exec(src);
  if (!m) return ['G2 DEFAULT_TEMPLATES not found'];
  for (const t of m[1].matchAll(/category:\s*'(\w+)'/g)) if (!['AUTHENTICATION', 'UTILITY'].includes(t[1])) out.push(`G2 a ${t[1]} template is registered on the common number`);
  if (!/AUTHENTICATION['"]\s*&&[\s\S]{0,80}UTILITY/.test(src) && !/!== 'AUTHENTICATION' && tpl\.category !== 'UTILITY'/.test(src)) out.push('G2 the gateway does not refuse templates that are not authentication or utility');
  if (!/const PROMO\s*=/.test(src) || !/PROMO\.test\(/.test(src)) out.push('G2 the promotional-word screen is gone');
  if (/async\s+sendText\s*\(|sendFreeText|sendBulk|broadcast\s*\(/i.test(src)) out.push('G2 the gateway has a free-text or bulk send');
  return out;
}

export function checkNoConsole(files) { return files.filter(([, s]) => /\bconsole\.(log|error|warn)\(/.test(s)).map(([f]) => `G4 console call in ${path.relative(ROOT, f)}`); }

export function checkTypedPrices(files) {
  const out = [];
  for (const [f, s] of files) s.split('\n').forEach((line, i) => { if (/^\s*(\/\/|\*|\/\*)/.test(line)) return; if (/₹\s?\d/.test(line) || /\b(Essentials|Workspace plan|BOS plan|DomainApp Startup)\b/.test(line)) out.push(`G5 typed price or plan name at ${path.relative(ROOT, f)}:${i + 1}`); });
  return out;
}

export function checkMigration(sql, name) {
  const out = [];
  const stmts = sql.replace(/--.*$/gm, '').split(';').map((x) => x.trim()).filter(Boolean);
  for (const s of stmts) {
    if (/^(DROP|TRUNCATE|DELETE|UPDATE|INSERT)\b/i.test(s)) out.push(`G6 ${name}: ${s.slice(0, 50)}`);
    if (/^ALTER TABLE/i.test(s) && !/ADD COLUMN/i.test(s)) out.push(`G6 ${name}: non-additive ALTER: ${s.slice(0, 60)}`);
    if (/ALTER TABLE "(?!g4d_(leadspace|lead_|consent|invalid|whatsapp|social|promotion|post_jobs|ad_spend))/i.test(s)) out.push(`G6 ${name}: alters a table that is not a LeadSpace table`);
  }
  return out;
}

export function checkDryRun(src, file) { return /--apply/.test(src) && /APPLY|DRY RUN/.test(src) ? [] : [`G7 ${file} is not dry-run by default`]; }

function run() {
  const feFiles = (dir) => (fs.existsSync(dir) ? walk(dir, ['.ts', '.tsx']).map((f) => [f, read(f)]) : []);
  const beSrc = [...walk(path.join(BE, 'src', 'leadspace'), ['.ts']), ...walk(path.join(BE, 'src', 'social'), ['.ts']), ...walk(path.join(BE, 'src', 'messaging'), ['.ts'])].map((f) => [f, read(f)]);
  problems.push(...checkControllers(beSrc));
  problems.push(...checkGateway(read(path.join(BE, 'src', 'messaging', 'whatsapp', 'whatsapp-gateway.service.ts'))));
  problems.push(...checkNoConsole(beSrc));
  problems.push(...checkTypedPrices([...feFiles(path.join(FE, 'leadspace')), ...feFiles(path.join(FE, 'app', 'dashboard', 'leadspace'))]));
  for (const m of fs.readdirSync(path.join(BE, 'prisma', 'migrations')).filter((d) => /leadspace/.test(d))) problems.push(...checkMigration(read(path.join(BE, 'prisma', 'migrations', m, 'migration.sql')), m));
  const rls = read(path.join(BE, 'prisma', 'sql', 'enable_rls_public.sql'));
  if (!/DO \$\$/.test(rls) || !/END \$\$;/.test(rls)) problems.push('G6 the RLS script lost its dollar quotes');
  for (const f of ['leadspace-migrate-campaigns.js', 'leadspace-onboard-pilots.js', 'leadspace-test-campaign-kit.js']) problems.push(...checkDryRun(read(path.join(BE, 'scripts', f)), f));

  // G8: the guard catches a seeded violation of each rule
  const seeded = [
    ['G1', checkControllers([['x', "@ApiTags('x')\n@Controller('admin/leadspace/x')\nexport class FooController {}"]])],
    ['G1', checkControllers([['x', "@UseGuards(LeadspaceStaffGuard)\n@Controller('admin/leadspace/prices')\nexport class MoneyController {}"]])],
    ['G3', checkControllers([['x', "@Public()\n@Controller('leadspace/secret')\nexport class OpenController {}"]])],
    ['G2', checkGateway("export const DEFAULT_TEMPLATES: T[] = [\n  { name: 'a', category: 'MARKETING', body: 'x' },\n];\nconst PROMO = /x/; PROMO.test(a); tpl.category !== 'AUTHENTICATION' && tpl.category !== 'UTILITY'")],
    ['G4', checkNoConsole([['x', "console.log('hello')"]])],
    ['G5', checkTypedPrices([['x', 'const a = "₹ 99";']])],
    ['G6', checkMigration('DROP TABLE "Vendor";', 't')],
    ['G6', checkMigration('ALTER TABLE "g4d_leadspace_profiles" ALTER COLUMN "x" SET NOT NULL;', 't')],
    ['G7', checkDryRun('writes right away', 'x.js')],
  ];
  for (const [rule, found] of seeded) if (!found.some((p) => p.startsWith(rule))) problems.push(`G8 the guard did not catch a seeded ${rule} violation`);

  if (problems.length) { for (const p of problems) console.error(`  x ${p}`); console.error(`\nleadspace guard: ${problems.length} problem(s)`); process.exit(1); }
  console.log(`leadspace guard: OK (${beSrc.length} backend files, ${walk(path.join(BE, 'prisma', 'migrations'), ['.sql']).filter((f) => /leadspace/.test(f)).length} LeadSpace migrations, seeded violations caught)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run();
