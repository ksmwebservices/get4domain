'use server';

import { redirect } from 'next/navigation';
import { api } from '@/lib/api';

/**
 * The real, no-script version of the primary-action popup: a form on its own page (/book, /enquire or /order) that sends through the same public action as the popup
 * (engine.enquiry into the vendor's CRM). Answers are short keys in the address, never text from the visitor, so a page can never echo something it was fed.
 */
const BASE_RE = /^\/(site|theme-pack)\/[A-Za-z0-9._-]{1,80}$/;
const KEEP_RE = /^[A-Za-z0-9._=&~-]{0,400}$/;
const FLOWS = new Set(['book', 'enquire', 'order']);
const SUB_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;

export async function submitFlow(formData: FormData): Promise<void> {
  const s = (k: string): string => (typeof formData.get(k) === 'string' ? (formData.get(k) as string).trim() : '');
  const base = s('base'); const flow = s('flow'); const keep = s('keep');
  if (!BASE_RE.test(base) || !FLOWS.has(flow)) redirect('/');
  const back = (q: string): never => redirect(`${base}/${flow}?${q}${keep && KEEP_RE.test(keep) ? `&${keep}` : ''}`);
  if (s('website')) back('sent=1'); // a hidden field only a program fills in: pretend it worked

  const name = s('name').slice(0, 120); const phone = s('phone').replace(/[\s-]/g, '').slice(0, 20); const email = s('email').slice(0, 160);
  if (name.length < 2) back('e=name');
  if (!/^(\+?91)?[6-9]\d{9}$/.test(phone)) back('e=phone');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) back('e=email');
  const date = s('date');
  if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < new Date().toISOString().slice(0, 10))) back('e=date');

  if (s('mode') === 'live') {
    const sub = s('subdomain');
    if (!SUB_RE.test(sub)) back('e=send');
    const parts = [s('title').slice(0, 80) || 'Request', s('choice') && `Choice: ${s('choice').slice(0, 120)}`, date && `Date: ${date}`, s('count') && `People: ${s('count').slice(0, 3)}`, email && `E-mail: ${email}`, s('message') && `Message: ${s('message').slice(0, 800)}`].filter(Boolean);
    try {
      await api.engineDispatchPublic(sub, 'engine.enquiry', { name, phone: phone.slice(-10), message: parts.join(' | ').slice(0, 1900), industry: s('family').slice(0, 40) || undefined });
    } catch {
      back('e=send');
    }
  }
  back('sent=1');
}
