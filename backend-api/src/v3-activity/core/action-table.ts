/**
 * Which signed-in request becomes which activity row (slice 5.20). Pure: a route pattern in, an action key out. Nothing here reads a request body's values, only its field names.
 *
 * Coverage by construction: EVERY mutating route under /v3/me and /v3/admin gets a key, either an explicit one below (the keys the alert rules look for) or one derived from the route. A route added
 * later is logged the day it exists, with no change here. The only exemption is a route that stores nothing, written down with its reason. Public, claim and webhook routes have no signed-in actor
 * and are not logged here (their effects reach the log through the signed-in action that follows them).
 */
export interface RouteAction { actionKey: string; entityType: string }

export const EXEMPT_ROUTES: ReadonlyArray<{ route: string; reason: string }> = [
  { route: 'POST /v3/me/site/theme/preview', reason: 'A preview draws the theme with the vendor\'s own content and stores nothing (the switch itself is logged).' },
];

/** The keys the alert rules look for, by exact method and route pattern. */
const EXPLICIT: Readonly<Record<string, RouteAction>> = {
  'POST /v3/me/payment-methods': { actionKey: 'payment_method.created', entityType: 'payment_method' },
  'PUT /v3/me/payment-methods/:id': { actionKey: 'payment_method.updated', entityType: 'payment_method' },
  'DELETE /v3/me/payment-methods/:id': { actionKey: 'payment_method.deleted', entityType: 'payment_method' },
  'POST /v3/me/domains/custom': { actionKey: 'domain.custom_added', entityType: 'domain' },
  'PUT /v3/me/domains/subdomain': { actionKey: 'domain.subdomain_changed', entityType: 'domain' },
  'POST /v3/me/domains/:id/primary': { actionKey: 'domain.primary_changed', entityType: 'domain' },
  'DELETE /v3/me/domains/:id': { actionKey: 'domain.removed', entityType: 'domain' },
  'POST /v3/admin/domains/:id/primary': { actionKey: 'domain.primary_changed', entityType: 'domain' },
  'POST /v3/admin/domains/:id/remove': { actionKey: 'domain.removed', entityType: 'domain' },
  'PUT /v3/admin/domains/:id/state': { actionKey: 'domain.state_changed', entityType: 'domain' },
  'PUT /v3/admin/vendors/:id/domains/subdomain': { actionKey: 'domain.subdomain_changed', entityType: 'domain' },
  'POST /v3/me/account/deletion-request': { actionKey: 'account.deletion_requested', entityType: 'account' },
  'POST /v3/admin/vendors/:id/lifecycle/convert-to-free': { actionKey: 'plan.state_changed', entityType: 'vendor' },
  'POST /v3/admin/vendors/:id/lifecycle/restore-pro': { actionKey: 'plan.state_changed', entityType: 'vendor' },
  'POST /v3/admin/vendors/:id/lifecycle/extend-grace': { actionKey: 'plan.state_changed', entityType: 'vendor' },
};
/** Routes where the profile's name or GST number may change; the body's field names decide. */
const IDENTITY_ROUTES: ReadonlySet<string> = new Set(['PUT /v3/me/directory', 'PUT /v3/admin/directory/businesses/:id']);

const NAME_FIELDS: ReadonlySet<string> = new Set(['name', 'businessName']);
const GST_FIELDS: ReadonlySet<string> = new Set(['gstNumber', 'gst', 'gstin']);

/** The identity fields a body names ('name', 'gstNumber'), by canonical name. A field being named is not a proof that its value changed; the rule over-reports rather than miss one. */
export function changedIdentityFields(bodyKeys: readonly string[]): string[] {
  const out: string[] = [];
  if (bodyKeys.some((k) => NAME_FIELDS.has(k))) out.push('name');
  if (bodyKeys.some((k) => GST_FIELDS.has(k))) out.push('gstNumber');
  return out;
}

const VERB: Readonly<Record<string, string>> = { POST: 'create', PUT: 'update', PATCH: 'update', DELETE: 'delete' };
const snake = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

export function actionFor(method: string, routePattern: string, bodyKeys: readonly string[]): RouteAction | null {
  const m = method.toUpperCase();
  if (!VERB[m]) return null;
  if (!/^\/v3\/(me|admin)\//.test(routePattern)) return null;
  const route = `${m} ${routePattern}`;
  if (EXEMPT_ROUTES.some((e) => e.route === route)) return null;
  if (IDENTITY_ROUTES.has(route) && changedIdentityFields(bodyKeys).length) return { actionKey: 'business.identity_changed', entityType: 'directory' };
  const explicit = EXPLICIT[route];
  if (explicit) return explicit;
  const parts = routePattern.replace(/^\/v3\/(me|admin)\//, '').split('/').filter((s) => s && !s.startsWith(':')).map(snake).filter(Boolean);
  const resource = parts[0] ?? 'request';
  const rest = parts.slice(1);
  return { actionKey: `${resource}.${rest.length ? rest.join('_') : VERB[m]}`, entityType: resource };
}

/** The vendor a request is about. A /v3/me route is the signed-in vendor's. A staff route names the vendor in /vendors/:id or :vendorId; any other :id is not a vendor. */
export function vendorOf(routePattern: string, params: Record<string, unknown>, principalVendorId: string | null): string | null {
  const pick = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v.slice(0, 64) : null);
  if (routePattern.startsWith('/v3/me/')) return pick(principalVendorId);
  if (routePattern.includes('/vendors/:id')) return pick(params.id);
  if (routePattern.includes(':vendorId')) return pick(params.vendorId);
  return null;
}

/** The last parameter of the route, as the entity id (capped). */
export function entityIdOf(routePattern: string, params: Record<string, unknown>): string | null {
  const names = [...routePattern.matchAll(/:([A-Za-z0-9_]+)/g)].map((x) => x[1]);
  const last = names[names.length - 1];
  const v = last ? params[last] : undefined;
  return typeof v === 'string' && v.length > 0 ? v.slice(0, 120) : null;
}
