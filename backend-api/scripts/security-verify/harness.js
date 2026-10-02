// Shared helpers for the security-patch verification scripts (2026-10-02).
// These exercise the REAL compiled services/controllers in dist/ with the two external systems —
// the database and Razorpay — replaced by in-memory fakes, so they never touch production data
// or the payment gateway. Run `npx nest build` first, then `node scripts/security-verify/<script>.js`.
const crypto = require('crypto');
const path = require('path');

process.env.RAZORPAY_KEY_SECRET = 'test_platform_secret';
process.env.RAZORPAY_KEY_ID = 'rzp_test_platform';
process.env.JWT_SECRET = 'test_jwt_secret_for_verification_only';
process.env.NODE_ENV = 'test';

const dist = (p) => require(path.join(__dirname, '..', '..', 'dist', 'src', p));

let passed = 0;
let failed = 0;
const failures = [];

function ok(label, cond, detail) {
  if (cond) { passed++; console.log(`  PASS  ${label}`); }
  else { failed++; failures.push(label); console.log(`  FAIL  ${label}${detail ? '  -> ' + detail : ''}`); }
}

/** Assert the promise REJECTS (optionally with an HTTP status / message fragment). */
async function rejects(label, promise, { status, includes } = {}) {
  try {
    await promise;
    ok(label, false, 'expected a rejection but it resolved');
  } catch (e) {
    const code = typeof e.getStatus === 'function' ? e.getStatus() : e.status;
    const msg = e.message || '';
    const okStatus = status === undefined || code === status;
    const okMsg = includes === undefined || msg.includes(includes);
    ok(`${label} [${code ?? 'err'}: ${msg.slice(0, 70)}]`, okStatus && okMsg, `status=${code} message=${msg}`);
  }
}

function section(title) { console.log(`\n== ${title}`); }

function finish() {
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) console.log('FAILED:\n - ' + failures.join('\n - '));
  // Exit on a later tick: process.exit() straight after closing an HTTP server trips a libuv assertion on Windows.
  process.exitCode = failed ? 1 : 0;
  setTimeout(() => process.exit(process.exitCode), 300);
}

const hmac = (secret, orderId, paymentId) => crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');

/** In-memory Razorpay account: orders created by "our server", payments made by "customers". */
function makeRazorpay(secret = process.env.RAZORPAY_KEY_SECRET) {
  const orders = new Map();
  const payments = new Map();
  let n = 0;
  const rz = {
    secret,
    down: false,
    orders: {
      async create(opts) {
        const id = `order_${++n}`;
        const o = { id, amount: opts.amount, currency: opts.currency, receipt: opts.receipt, notes: opts.notes ?? [], status: 'created' };
        orders.set(id, o);
        return o;
      },
      async fetch(id) {
        if (rz.down) throw new Error('ECONNRESET');
        const o = orders.get(id);
        if (!o) { const e = new Error('not found'); e.statusCode = 400; throw e; }
        return o;
      },
    },
    payments: {
      async fetch(id) {
        if (rz.down) throw new Error('ECONNRESET');
        const p = payments.get(id);
        if (!p) { const e = new Error('not found'); e.statusCode = 400; throw e; }
        return p;
      },
    },
    /** A customer pays an order. Returns the {order, payment, signature} the browser would hand back. */
    pay(orderId, { status = 'captured', amount } = {}) {
      const o = orders.get(orderId);
      const id = `pay_${++n}`;
      payments.set(id, { id, order_id: orderId, amount: amount ?? o.amount, currency: 'INR', status });
      return { razorpayOrderId: orderId, razorpayPaymentId: id, razorpaySignature: hmac(secret, orderId, id) };
    },
    /** A payment on an order the attacker created in their OWN Razorpay-less fantasy: unknown order. */
    orders_,
  };
  function orders_() { return orders; }
  return rz;
}

/** Proxy that records calls and returns harmless defaults — for collaborators we don't care about. */
function recorder(name = 'fake', overrides = {}) {
  const calls = [];
  const target = { calls };
  return new Proxy(target, {
    get(t, prop) {
      if (prop in overrides) return overrides[prop];
      if (prop in t) return t[prop];
      if (prop === 'then') return undefined;
      return (...args) => { calls.push({ fn: String(prop), args }); return Promise.resolve(undefined); };
    },
  });
}

module.exports = { dist, ok, rejects, section, finish, hmac, makeRazorpay, recorder };
