/**
 * Pure rules of appointments (slice 5.24b, Professional): working hours, free slots, the appointment state machine. No clock, no database, no randomness; "now" comes in as a number.
 * Request and confirm: a customer's request is REQUESTED and blocks its slot; only the business moves it to CONFIRMED. There is no automatic path to CONFIRMED anywhere in this module.
 * All times are India time (UTC+5:30), the zone of every business on the platform.
 */
export const APPT_STATES = ['REQUESTED', 'CONFIRMED', 'DECLINED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'] as const;
export type ApptState = (typeof APPT_STATES)[number];
export const isApptState = (v: unknown): v is ApptState => typeof v === 'string' && (APPT_STATES as readonly string[]).includes(v);
/** States that hold their slot: nobody else can take the time. */
export const HOLDING_STATES: readonly ApptState[] = ['REQUESTED', 'CONFIRMED'];

const NEXT: Readonly<Record<ApptState, readonly ApptState[]>> = {
  REQUESTED: ['CONFIRMED', 'DECLINED', 'CANCELLED'], CONFIRMED: ['COMPLETED', 'NO_SHOW', 'CANCELLED'], DECLINED: [], CANCELLED: [], COMPLETED: [], NO_SHOW: [],
};
export const canApptMove = (from: ApptState, to: ApptState): boolean => NEXT[from].includes(to);

export type Checked<T> = { ok: true; value: T } | { ok: false; problems: string[] };

export interface HoursWindow { day: number; start: string; end: string }
const HM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const minutes = (hm: string): number => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));

/** Windows by weekday (0 Sunday to 6 Saturday), "HH:MM" in India time, start before end, no two windows of a day overlapping. Returned in day and time order. */
export function checkHours(raw: unknown): Checked<HoursWindow[]> {
  if (!Array.isArray(raw) || raw.length > 28) return { ok: false, problems: ['hours: a list of at most 28 windows'] };
  const out: HoursWindow[] = [];
  for (const w of raw as Array<Record<string, unknown>>) {
    if (!Number.isInteger(w?.day) || (w.day as number) < 0 || (w.day as number) > 6) return { ok: false, problems: ['hours: day is 0 (Sunday) to 6 (Saturday)'] };
    if (typeof w.start !== 'string' || typeof w.end !== 'string' || !HM.test(w.start) || !HM.test(w.end)) return { ok: false, problems: ['hours: start and end are HH:MM, 24 hour'] };
    if (minutes(w.start) >= minutes(w.end)) return { ok: false, problems: ['hours: start must be before end'] };
    out.push({ day: w.day as number, start: w.start, end: w.end });
  }
  out.sort((a, b) => a.day - b.day || minutes(a.start) - minutes(b.start));
  for (let i = 1; i < out.length; i++) if (out[i].day === out[i - 1].day && minutes(out[i].start) < minutes(out[i - 1].end)) return { ok: false, problems: ['hours: two windows of one day overlap'] };
  return { ok: true, value: out };
}

export interface ServiceFields { name: string; durationMin: number; pricePaise: number | null }
export function checkServiceInput(i: { name?: unknown; durationMin?: unknown; pricePaise?: unknown }): Checked<ServiceFields> {
  const problems: string[] = [];
  const name = typeof i.name === 'string' ? i.name.trim().replace(/\s+/g, ' ') : '';
  if (name.length < 1 || name.length > 120) problems.push('name: 1 to 120 characters');
  if (!Number.isInteger(i.durationMin) || (i.durationMin as number) < 5 || (i.durationMin as number) > 480 || (i.durationMin as number) % 5 !== 0) problems.push('durationMin: 5 to 480, in steps of 5');
  let pricePaise: number | null = null;
  if (i.pricePaise !== undefined && i.pricePaise !== null) { if (Number.isSafeInteger(i.pricePaise) && (i.pricePaise as number) >= 0) pricePaise = i.pricePaise as number; else problems.push('pricePaise: a whole number of paise, zero or more'); }
  if (problems.length) return { ok: false, problems };
  return { ok: true, value: { name, durationMin: i.durationMin as number, pricePaise } };
}

export interface Interval { startMs: number; endMs: number }
export const overlaps = (a: Interval, b: Interval): boolean => a.startMs < b.endMs && b.startMs < a.endMs;

const IST_MS = 330 * 60_000;
const DAY_MS = 86_400_000;
const istDays = (ms: number): number => Math.floor((ms + IST_MS) / DAY_MS);
/** The India day (YYYY-MM-DD) a moment falls on. */
export function dayOfStart(ms: number): string {
  const z = istDays(ms) + 719_468; const era = Math.floor(z / 146_097); const doe = z - era * 146_097; const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36_524) - Math.floor(doe / 146_096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100)); const mp = Math.floor((5 * doy + 2) / 153); const d = doy - Math.floor((153 * mp + 2) / 5) + 1; const m = mp < 10 ? mp + 3 : mp - 9; const y = yoe + era * 400 + (m <= 2 ? 1 : 0);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
const startOfDay = (day: string): number => Date.parse(`${day}T00:00:00+05:30`);

/** The start times (epoch ms) a customer can ask for on one India day: on the length grid from each window start, fully inside the window, in the future, and not overlapping anything that holds a slot. */
export function freeSlots(i: { hours: readonly HoursWindow[]; durationMin: number; day: string; busy: readonly Interval[]; nowMs: number }): number[] {
  const t0 = startOfDay(i.day); if (Number.isNaN(t0)) return [];
  const weekday = (istDays(t0) + 4) % 7;   // 1 January 1970 was a Thursday
  const len = i.durationMin * 60_000; const out: number[] = [];
  for (const w of i.hours.filter((x) => x.day === weekday)) {
    const from = t0 + minutes(w.start) * 60_000; const to = t0 + minutes(w.end) * 60_000;
    for (let s = from; s + len <= to; s += len) if (s > i.nowMs && !i.busy.some((b) => overlaps({ startMs: s, endMs: s + len }, b))) out.push(s);
  }
  return out;
}
