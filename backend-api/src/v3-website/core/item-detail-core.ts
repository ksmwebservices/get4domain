/**
 * Item detail (Website Manager lane A, item f), pure. An item (a service, product or project) can have its own landing page with a title, a short summary, the full details, a price,
 * a few pictures, its own questions and answers, a status and an area. The vendor writes them in the managed document list `itemDetails`, one row per item id, so they have a draft,
 * a preview, a publish and revisions like every other edit. Pictures and questions are written one per line: `https://link | description` and `question | answer`.
 */
export const ITEM_STATUSES = ['ongoing', 'upcoming', 'completed'] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];
export const ITEM_IMAGES_MAX = 12;
export const ITEM_FAQS_MAX = 10;

export interface ItemImage { src: string; alt: string }
export interface ItemFaq { q: string; a: string }
type Parsed<T> = { ok: true; rows: T[] } | { ok: false; message: string; line: number };

const lines = (text: unknown): string[] => String(text ?? '').split('\n').map((l) => l.trim()).filter((l) => l !== '');
const isHttps = (v: string): boolean => { try { const u = new URL(v); return u.protocol === 'https:' && !u.username && !u.password && u.hostname.includes('.') && !/\s/.test(v); } catch { return false; } };

/** `https link | description` per line. Every picture needs a description (alt text). */
export function parseImageLines(text: unknown): Parsed<ItemImage> {
  const rows: ItemImage[] = [];
  for (const [i, l] of lines(text).entries()) {
    const [src, ...rest] = l.split('|').map((p) => p.trim());
    const alt = rest.join(' | ').trim();
    if (!isHttps(src)) return { ok: false, message: 'Each picture line starts with a full link that begins with https://.', line: i + 1 };
    if (!alt || alt.length > 160) return { ok: false, message: 'Each picture needs a short description after the | sign (up to 160 characters).', line: i + 1 };
    rows.push({ src, alt });
  }
  if (rows.length > ITEM_IMAGES_MAX) return { ok: false, message: `Use at most ${ITEM_IMAGES_MAX} pictures.`, line: ITEM_IMAGES_MAX + 1 };
  return { ok: true, rows };
}

/** `question | answer` per line. */
export function parseFaqLines(text: unknown): Parsed<ItemFaq> {
  const rows: ItemFaq[] = [];
  for (const [i, l] of lines(text).entries()) {
    const [q, ...rest] = l.split('|').map((p) => p.trim());
    const a = rest.join(' | ').trim();
    if (!q || !a || q.length > 200 || a.length > 1000) return { ok: false, message: 'Each line is a question, a | sign and an answer (question up to 200, answer up to 1000 characters).', line: i + 1 };
    rows.push({ q, a });
  }
  if (rows.length > ITEM_FAQS_MAX) return { ok: false, message: `Use at most ${ITEM_FAQS_MAX} questions.`, line: ITEM_FAQS_MAX + 1 };
  return { ok: true, rows };
}

/** Checks the parts of one `itemDetails` row that are more than plain text. Returns null when fine, else the problem and the field it belongs to. */
export function itemDetailProblem(row: Record<string, string | boolean>): { message: string; field: string } | null {
  const status = String(row.status ?? '');
  if (status !== '' && !(ITEM_STATUSES as readonly string[]).includes(status)) return { message: `Status must be one of: ${ITEM_STATUSES.join(', ')}.`, field: 'status' };
  const imgs = parseImageLines(row.images); if (!imgs.ok) return { message: `${imgs.message} (line ${imgs.line})`, field: 'images' };
  const faqs = parseFaqLines(row.faqs); if (!faqs.ok) return { message: `${faqs.message} (line ${faqs.line})`, field: 'faqs' };
  return null;
}
