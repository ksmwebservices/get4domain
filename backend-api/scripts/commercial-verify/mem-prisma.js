// In-memory stand-in for PrismaService, just faithful enough to run the REAL compiled commercial-engine
// services (dist/) without a database: Prisma `where` operators, unique constraints (P2002), defaults,
// increment/decrement, interactive transactions, and per-key advisory locks that really serialise callers.
const path = require('path');
const crypto = require('crypto');
const { Prisma } = require(path.join(__dirname, '..', '..', 'node_modules', '@prisma', 'client'));

const UNIQUE = {
  invoice: [['id'], ['invoiceNumber'], ['payTokenHash']],
  manualPaymentSubmission: [['id'], ['utr']],
  promoCode: [['id'], ['code']],
  promoRedemption: [['id'], ['invoiceId']],
  payeeSettings: [['id'], ['key']],
  vendor: [['id'], ['email'], ['subdomain']],
  wallet: [['id'], ['vendorId']],
  billingTerm: [['id']],
};

const DEFAULTS = {
  invoice: () => ({ status: 'PENDING', paidPaise: 0, overpaymentPaise: 0, discountPaise: 0, gstMode: 'EXCLUSIVE', allowedChannels: [], adminDiscount: false, allowPromoStacking: false, allowPromoEntry: false, razorpayPaymentId: null, effectsAppliedAt: null }),
  billingTerm: () => ({ isCurrent: true, graceDays: 7, discountPaise: 0, allowedChannels: [], status: 'DEMO', source: 'STANDARD', reminders: null, renewalInvoiceId: null, lapsedAt: null, paymentDueAt: null, scheduledNextPlan: null, scheduledNextCycle: null, scheduledNextCycleMonths: null, subscriptionId: null }),
  subscription: () => ({ themeChangesUsed: 0 }),
  manualPaymentSubmission: () => ({ status: 'SUBMITTED', confirmedAmountPaise: null, reviewedBy: null, reviewedAt: null, reason: null }),
  promoCode: () => ({ active: true, perVendorLimit: 1, appliesToPlans: [], appliesToCycles: [], appliesToKinds: [], minCycleMonths: null, validFrom: null, validTo: null, maxRedemptions: null }),
  planChangeRequest: () => ({ status: 'REQUESTED', effective: 'AT_RENEWAL', prorationCreditPaise: 0, newInvoiceId: null }),
  billingDeal: () => ({ status: 'DRAFT', activateNow: false }),
  vendor: () => ({ isSandbox: false, expiresAt: null, status: 'ACTIVE', role: 'VENDOR', phone: null }),
  wallet: () => ({ balance: 0, totalCredited: 0, totalDebited: 0 }),
};

const isOpObj = (v) => v && typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v) && Object.keys(v).some((k) => ['in', 'notIn', 'not', 'lt', 'lte', 'gt', 'gte', 'contains', 'startsWith', 'equals'].includes(k));

function matchValue(actual, cond) {
  if (!isOpObj(cond)) {
    if (cond instanceof Date && actual instanceof Date) return actual.getTime() === cond.getTime();
    return actual === cond || (actual == null && cond === null);
  }
  for (const [op, v] of Object.entries(cond)) {
    switch (op) {
      case 'equals': if (actual !== v) return false; break;
      case 'in': if (!v.includes(actual)) return false; break;
      case 'notIn': if (v.includes(actual)) return false; break;
      case 'not': {
        const pass = v === null ? actual != null : isOpObj(v) ? !matchValue(actual, v) : actual !== v;
        if (!pass) return false;
        break;
      }
      case 'lt': if (!(actual != null && actual < v)) return false; break;
      case 'lte': if (!(actual != null && actual <= v)) return false; break;
      case 'gt': if (!(actual != null && actual > v)) return false; break;
      case 'gte': if (!(actual != null && actual >= v)) return false; break;
      case 'contains': if (!(typeof actual === 'string' && actual.toLowerCase().includes(String(v).toLowerCase()))) return false; break;
      case 'startsWith': if (!(typeof actual === 'string' && actual.startsWith(v))) return false; break;
      case 'mode': break;
      default: throw new Error(`mem-prisma: unsupported operator ${op}`);
    }
  }
  return true;
}

function matches(row, where) {
  if (!where) return true;
  for (const [k, cond] of Object.entries(where)) {
    if (k === 'OR') { if (!cond.some((w) => matches(row, w))) return false; continue; }
    if (k === 'AND') { if (!cond.every((w) => matches(row, w))) return false; continue; }
    if (k === 'NOT') { if (matches(row, cond)) return false; continue; }
    if (!matchValue(row[k], cond)) return false;
  }
  return true;
}

function applyData(row, data) {
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v) && ('increment' in v || 'decrement' in v)) {
      row[k] = (row[k] ?? 0) + (v.increment ?? 0) - (v.decrement ?? 0);
    } else if (v === Prisma.DbNull || v === Prisma.JsonNull) row[k] = null;
    else if (v !== undefined) row[k] = v;
  }
}

function project(r, select) {
  if (!select) return { ...r };
  const o = {};
  for (const k of Object.keys(select)) if (select[k]) o[k] = r[k];
  return o;
}

function sorter(orderBy) {
  if (!orderBy) return null;
  const list = Array.isArray(orderBy) ? orderBy : [orderBy];
  return (a, b) => {
    for (const o of list) {
      const [k, dir] = Object.entries(o)[0];
      const av = a[k]; const bv = b[k];
      if (av === bv) continue;
      const c = av > bv ? 1 : -1;
      return dir === 'desc' ? -c : c;
    }
    return 0;
  };
}

function createMemPrisma(seed = {}) {
  const tables = {};
  const locks = new Map(); // advisory lock key -> promise chain
  const tbl = (name) => (tables[name] ??= []);
  for (const [n, rows] of Object.entries(seed)) tbl(n).push(...rows.map((r) => ({ ...r })));
  let seq = 0;

  const dupError = (model, fields) => new Prisma.PrismaClientKnownRequestError(`Unique constraint failed on ${model}.${fields.join(',')}`, { code: 'P2002', clientVersion: 'mem' });

  function checkUnique(model, row, ignore) {
    for (const fields of UNIQUE[model] ?? []) {
      if (fields.every((f) => row[f] == null)) continue;
      const clash = tbl(model).find((r) => r !== ignore && fields.every((f) => r[f] === row[f]));
      if (clash) throw dupError(model, fields);
    }
  }

  function modelApi(model, ctx) {
    const rows = () => tbl(model);
    const find = (where) => rows().find((r) => matches(r, where)) ?? null;
    const api = {
      async findUnique({ where, select }) { await Promise.resolve(); const r = find(where); return r ? project(r, select) : null; },
      async findUniqueOrThrow({ where }) { const r = await api.findUnique({ where }); if (!r) throw new Error(`${model} not found`); return r; },
      async findFirst({ where, orderBy, select } = {}) {
        await Promise.resolve();
        let list = rows().filter((r) => matches(r, where));
        const s = sorter(orderBy); if (s) list = [...list].sort(s);
        return list[0] ? project(list[0], select) : null;
      },
      async findMany({ where, orderBy, take, select } = {}) {
        await Promise.resolve();
        let list = rows().filter((r) => matches(r, where));
        const s = sorter(orderBy); if (s) list = [...list].sort(s);
        if (take) list = list.slice(0, take);
        return list.map((r) => project(r, select));
      },
      async count({ where } = {}) { await Promise.resolve(); return rows().filter((r) => matches(r, where)).length; },
      async create({ data }) {
        await Promise.resolve();
        const now = new Date();
        const row = { id: `${model}_${++seq}`, createdAt: now, updatedAt: now, ...(DEFAULTS[model]?.() ?? {}) };
        applyData(row, data);
        checkUnique(model, row);
        rows().push(row);
        return { ...row };
      },
      async update({ where, data }) {
        await Promise.resolve();
        const r = find(where); if (!r) throw new Error(`${model} not found for update`);
        const copy = { ...r }; applyData(copy, data); checkUnique(model, copy, r);
        applyData(r, data); r.updatedAt = new Date();
        return { ...r };
      },
      async updateMany({ where, data }) {
        await Promise.resolve();
        const hit = rows().filter((r) => matches(r, where));
        for (const r of hit) { applyData(r, data); r.updatedAt = new Date(); }
        return { count: hit.length };
      },
      async upsert({ where, create, update }) {
        const r = find(where);
        if (r) return api.update({ where, data: update });
        return api.create({ data: create });
      },
      async delete({ where }) { const i = rows().findIndex((r) => matches(r, where)); if (i < 0) throw new Error('not found'); const [r] = rows().splice(i, 1); return r; },
      async deleteMany({ where } = {}) { const keep = rows().filter((r) => !matches(r, where)); const n = rows().length - keep.length; tables[model] = keep; return { count: n }; },
    };
    return api;
  }

  async function acquire(ctx, key, tryOnly) {
    const held = locks.get(key);
    if (tryOnly) { if (held) return false; locks.set(key, Promise.resolve()); ctx.keys.push(key); ctx.release.push(() => locks.delete(key)); return true; }
    while (locks.get(key)) await locks.get(key);
    let release;
    locks.set(key, new Promise((r) => { release = r; }));
    ctx.keys.push(key);
    ctx.release.push(() => { locks.delete(key); release(); });
    return true;
  }

  function build(ctx) {
    return new Proxy({}, {
      get(_t, prop) {
        if (prop === 'then') return undefined;
        if (prop === '$transaction') {
          return async (fn) => {
            if (typeof fn !== 'function') return Promise.all(fn);
            const txCtx = { keys: [], release: [] };
            try { return await fn(build(txCtx)); }
            finally { for (const r of txCtx.release.reverse()) r(); }
          };
        }
        if (prop === '$queryRawUnsafe') {
          return async (sql, key) => {
            if (/pg_advisory_xact_lock/.test(sql) && !/try/.test(sql)) { await acquire(ctx, String(key), false); return [{}]; }
            if (/pg_try_advisory_xact_lock/.test(sql)) return [{ ok: await acquire(ctx, String(key), true) }];
            return [];
          };
        }
        if (prop === '$tables') return tables;
        return modelApi(String(prop), ctx);
      },
    });
  }
  return build({ keys: [], release: [] });
}

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
module.exports = { createMemPrisma, sha };
