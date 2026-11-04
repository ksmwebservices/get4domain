/**
 * Redaction of a provider webhook before it is stored (slice 5.1b). A WHITELIST, not a blacklist: only the listed keys survive, so a new personal or card-like field the provider adds
 * later is dropped by default. Contact, email, VPA, card, bank, wallet, notes, acquirer data and free-text error descriptions are never kept.
 */
const PAYMENT_KEYS = ['id', 'entity', 'amount', 'currency', 'status', 'order_id', 'method', 'captured'] as const;
const ORDER_KEYS = ['id', 'entity', 'amount', 'amount_paid', 'amount_due', 'currency', 'receipt', 'status', 'attempts'] as const;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const scalar = (v: unknown): boolean => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
const pick = (src: unknown, keys: readonly string[]): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  if (isObj(src)) for (const k of keys) if (scalar(src[k])) out[k] = src[k];
  return out;
};

export function redactPaymentPayload(raw: unknown): Record<string, unknown> {
  if (!isObj(raw)) return {};
  const out: Record<string, unknown> = {};
  if (typeof raw.event === 'string') out.event = raw.event.slice(0, 60);
  if (typeof raw.created_at === 'number') out.created_at = raw.created_at;
  const payload = isObj(raw.payload) ? raw.payload : {};
  const red: Record<string, unknown> = {};
  const pay = isObj(payload.payment) ? pick(payload.payment.entity, PAYMENT_KEYS) : null;
  const ord = isObj(payload.order) ? pick(payload.order.entity, ORDER_KEYS) : null;
  if (pay && Object.keys(pay).length) red.payment = { entity: pay };
  if (ord && Object.keys(ord).length) red.order = { entity: ord };
  if (Object.keys(red).length) out.payload = red;
  return out;
}
