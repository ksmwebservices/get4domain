// Pure helpers for the vendor Notifications screen.

export interface VendorNotification {
  id: string; type: string; priority?: string; title: string; message: string; read: boolean; createdAt: string;
  data?: Record<string, unknown> | null; actionType?: string | null; actionData?: Record<string, unknown> | null;
}
export type NotificationKind = 'order' | 'stock' | 'lead' | 'success' | 'info' | 'warning';

/** Which icon/tone a notification type gets. Unknown types are plain information. */
export function notificationMeta(type: string): NotificationKind {
  const t = (type || '').toLowerCase();
  if (t === 'new_order') return 'order';
  if (t === 'low_stock') return 'stock';
  if (t === 'paid_shortfall') return 'warning';
  if (t.includes('lead') || t.includes('enquiry') || t === 'whatsapp_bot' || t === 'realestate_token_payment') return 'lead';
  if (t === 'billing') return 'info';
  return 'info';
}

/** Where tapping a notification goes. Only same-site dashboard paths are ever returned. */
export function notificationLink(n: Pick<VendorNotification, 'type' | 'data' | 'actionType'>): string | null {
  const t = (n.type || '').toLowerCase();
  if (t === 'new_order' || t === 'paid_shortfall') return '/dashboard/orders';
  if (t === 'low_stock') return '/dashboard/stock';
  if (t.includes('lead') || t.includes('enquiry') || n.actionType === 'view_lead') return '/dashboard/crm';
  const link = n.data && typeof n.data === 'object' ? (n.data as { link?: unknown }).link : undefined;
  return typeof link === 'string' && /^\/dashboard(\/|$)/.test(link) ? link : null;
}

export function timeAgo(iso: string, now = Date.now()): string {
  const mins = Math.floor((now - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
