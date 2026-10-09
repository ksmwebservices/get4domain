#!/usr/bin/env node
// Bug B2 class audit + permanent guard.   node scripts/audit-credential-fields.mjs [--list]
//
// B2 was: a plain text box (Razorpay Key ID) sat directly before a password box with no autocomplete attribute, so the browser treated the text box as
// the "username" and put the saved login e-mail into it, and the save then stored the e-mail. The class: any credential-like input without an explicit
// autocomplete decision. A credential-like input is an <input> that is type=password, or whose name / id / label / placeholder talks about a key, secret,
// token, password or API; and every plain text input that sits right before a password input.
// Rule: it must say autoComplete="off" | "new-password" | "current-password" | "one-time-code" | "username" | "email" (login and sign-up forms say it on purpose).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const LIST = process.argv.includes('--list');
const walk = (d, acc = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (!['node_modules', '.next'].includes(e.name)) walk(p, acc); } else if (/\.tsx$/.test(e.name)) acc.push(p); } return acc; };

/** Every <input ...> element's attribute text, brace-aware (an arrow function inside onChange={...} contains a '>'). */
function scanInputs(src) {
  const out = [];
  for (const m of src.matchAll(/<input(?=[\s/>])/g)) {
    let i = m.index + 6; let depth = 0; let quote = null;
    for (; i < src.length; i += 1) {
      const c = src[i];
      if (quote) { if (c === quote) quote = null; continue; }
      if (c === '"' || c === "'" || c === '`') { if (depth > 0 || src[i - 1] === '=') quote = c; continue; }
      if (c === '{') depth += 1;
      else if (c === '}') depth -= 1;
      else if (c === '>' && depth === 0) break;
    }
    out.push({ text: src.slice(m.index + 6, i), at: m.index });
  }
  return out;
}

const TYPE = /type=(?:"([^"]*)"|'([^']*)'|\{([^}]*)\})/;
const typeOf = (t) => { const m = TYPE.exec(t); return m ? (m[1] ?? m[2] ?? m[3] ?? '') : 'text'; };
const CRED = /(secret|token|password|api[-_ ]?key|key[-_ ]?id|access[-_ ]?key|private[-_ ]?key|razorpay|webhook)/i;
const rows = [];
for (const f of walk(ROOT)) {
  const rel = path.relative(ROOT, f).split(path.sep).join('/');
  const src = fs.readFileSync(f, 'utf8');
  const inputs = scanInputs(src);
  inputs.forEach((inp, i) => {
    const t = inp.text;
    if (/^(checkbox|radio|file|number|hidden|submit|button|range|date)$/.test(typeOf(t))) return; // nothing is typed that a browser could autofill
    const isPassword = /password/.test(typeOf(t));
    const above = src.slice(Math.max(0, inp.at - 220), inp.at).split('\n').slice(-2).join(' '); // the label just above it
    const namedCredential = CRED.test(t) || CRED.test(above);
    const next = inputs[i + 1];
    const beforePassword = Boolean(next && /password/.test(typeOf(next.text)) && next.at - inp.at < 900);
    if (!isPassword && !namedCredential && !beforePassword) return;
    const ac = /autoComplete=(?:"([^"]*)"|\{([^}]*)\})/.exec(t);
    rows.push({ rel, line: src.slice(0, inp.at).split('\n').length, why: isPassword ? 'password' : beforePassword ? 'before a password box' : 'credential-like', ac: ac ? (ac[1] ?? ac[2]) : null });
  });
}
const OK = /^(off|new-password|current-password|one-time-code|username|email|tel|name)$/;
const bad = rows.filter((r) => !r.ac || (!OK.test(r.ac) && !/\?/.test(r.ac)));
console.log(`credential-like inputs found: ${rows.length}; without an explicit autocomplete decision: ${bad.length}`);
for (const r of LIST ? rows : bad) console.log(`  ${r.ac ? `ok (${r.ac})`.padEnd(22) : 'MISSING'.padEnd(22)} ${r.rel}:${r.line}  (${r.why})`);
if (bad.length) { console.error('\nFAIL: add autoComplete="off" (a key / token / secret / id) or "new-password" (a password being set) to each input above.'); process.exit(1); }
console.log('PASS: every credential-like input decides its autocomplete.');
