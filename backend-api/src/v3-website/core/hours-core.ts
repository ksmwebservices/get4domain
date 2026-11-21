/**
 * Opening hours as the theme renderer draws them (Wave 2 Part G), pure: up to seven rows, one per day, each `{ day, open, close, closed }`, which is exactly the row shape `<g4d-hours>` reads.
 * The site had the renderer slot but no place to keep the rows (the older document held one line of free text), so the managed document gains an optional `hours` list. Nothing here is a link, a button or a form.
 */
export const HOURS_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export type HoursDay = (typeof HOURS_DAYS)[number];
export interface HoursRow { day: HoursDay; open: string; close: string; closed: boolean }
export type HoursFail = { ok: false; code: string; message: string; field: string };

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DAY_LONG: Readonly<Record<string, HoursDay>> = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun', mon: 'Mon', tue: 'Tue', tues: 'Tue', wed: 'Wed', thu: 'Thu', thur: 'Thu', thurs: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
const mins = (t: string): number => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

/** Checks the rows: each day at most once, a closed day has no times, an open day has an opening time before its closing time. Returns the rows in week order. */
export function validateHours(input: unknown): { ok: true; rows: HoursRow[] } | HoursFail {
  const f = (code: string, message: string, field = 'hours'): HoursFail => ({ ok: false, code, message, field });
  if (!Array.isArray(input)) return f('FIELD_INVALID', 'Send the opening hours as a list of days.');
  if (input.length > 7) return f('FIELD_INVALID', 'There are at most seven days.');
  const seen = new Set<string>(); const out: HoursRow[] = [];
  for (const r of input) {
    if (!r || typeof r !== 'object' || Array.isArray(r) || Object.keys(r).some((k) => !['day', 'open', 'close', 'closed'].includes(k))) return f('FIELD_INVALID', 'Each day has a day, an opening time, a closing time or closed.');
    const o = r as { day?: unknown; open?: unknown; close?: unknown; closed?: unknown };
    const day = typeof o.day === 'string' ? DAY_LONG[o.day.trim().toLowerCase()] : undefined;
    if (!day) return f('FIELD_INVALID', 'The day must be Mon, Tue, Wed, Thu, Fri, Sat or Sun.', 'day');
    if (seen.has(day)) return f('FIELD_INVALID', `${day} is given twice.`, 'day'); seen.add(day);
    if (o.closed === true) { out.push({ day, open: '', close: '', closed: true }); continue; }
    if (typeof o.open !== 'string' || typeof o.close !== 'string' || !TIME.test(o.open) || !TIME.test(o.close)) return f('FIELD_INVALID', `Give ${day} an opening and a closing time as HH:MM, or mark it closed.`, 'open');
    if (mins(o.close) <= mins(o.open)) return f('FIELD_INVALID', `${day} must close after it opens.`, 'close');
    out.push({ day, open: o.open, close: o.close, closed: false });
  }
  return { ok: true, rows: out.sort((a, b) => HOURS_DAYS.indexOf(a.day) - HOURS_DAYS.indexOf(b.day)) };
}

/**
 * The compact text staff type in a spreadsheet or a box: "Mon-Sat 09:00-18:00; Sun closed". A range of days shares one time; a day or range may be "closed". Day names in full or short form, any case.
 * Anything it cannot read is refused with the part it could not read, never guessed.
 */
export function parseHoursText(text: string): { ok: true; rows: HoursRow[] } | HoursFail {
  const f = (message: string): HoursFail => ({ ok: false, code: 'FIELD_INVALID', message, field: 'hours' });
  const parts = String(text ?? '').split(';').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return { ok: true, rows: [] };
  const rows: unknown[] = [];
  for (const p of parts) {
    const m = /^([A-Za-z]+)(?:\s*(?:-|to)\s*([A-Za-z]+))?\s+(closed|(\d{1,2}:\d{2})\s*(?:-|to)\s*(\d{1,2}:\d{2}))$/i.exec(p);
    if (!m) return f(`Could not read "${p}". Write it like Mon-Sat 09:00-18:00; Sun closed.`);
    const a = DAY_LONG[m[1].toLowerCase()]; const b = m[2] ? DAY_LONG[m[2].toLowerCase()] : a;
    if (!a || !b || HOURS_DAYS.indexOf(b) < HOURS_DAYS.indexOf(a)) return f(`Could not read the days in "${p}".`);
    const pad = (t: string): string => (t.length === 4 ? `0${t}` : t);
    for (let i = HOURS_DAYS.indexOf(a); i <= HOURS_DAYS.indexOf(b); i++) rows.push(m[3].toLowerCase() === 'closed' ? { day: HOURS_DAYS[i], closed: true } : { day: HOURS_DAYS[i], open: pad(m[4]), close: pad(m[5]), closed: false });
  }
  return validateHours(rows);
}

/** One line of text for places that take only text (the older hours column, the search file): "Mon 09:00-18:00, Tue 09:00-18:00, Sun closed". */
export const hoursText = (rows: readonly HoursRow[]): string => rows.map((r) => (r.closed ? `${r.day} closed` : `${r.day} ${r.open}-${r.close}`)).join(', ');
