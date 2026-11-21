import { APPT_STATES, canApptMove, checkHours, checkServiceInput, dayOfStart, freeSlots, overlaps } from '../src/v3-appointments/core/appointments-core';

const MON = '2026-11-16';   // a Monday
const at = (day: string, hm: string): number => Date.parse(`${day}T${hm}:00+05:30`);
const week = (windows: Array<{ day: number; start: string; end: string }>) => { const r = checkHours(windows); if (!r.ok) throw new Error(r.problems.join(';')); return r.value; };

describe('working hours', () => {
  it('accepts windows per weekday and keeps them in order', () => { expect(week([{ day: 1, start: '14:00', end: '18:00' }, { day: 1, start: '09:00', end: '13:00' }])).toEqual([{ day: 1, start: '09:00', end: '13:00' }, { day: 1, start: '14:00', end: '18:00' }]); });
  it.each([[[{ day: 7, start: '09:00', end: '10:00' }]], [[{ day: 1, start: '10:00', end: '09:00' }]], [[{ day: 1, start: '9:00', end: '10:00' }]], [[{ day: 1, start: '09:00', end: '12:00' }, { day: 1, start: '11:00', end: '13:00' }]], [[{ day: 1, start: '09:00', end: '24:30' }]], ['no']])('refuses %j', (bad) => { expect(checkHours(bad).ok).toBe(false); });
  it('no hours at all is allowed: the provider simply has no slots', () => { expect(checkHours([])).toEqual({ ok: true, value: [] }); });
});

describe('service input', () => {
  it('needs a name and a length in whole five-minute steps', () => {
    expect(checkServiceInput({ name: 'Consultation', durationMin: 30, pricePaise: 50000 })).toMatchObject({ ok: true, value: { durationMin: 30, pricePaise: 50000 } });
    for (const bad of [{ name: '', durationMin: 30 }, { name: 'x', durationMin: 7 }, { name: 'x', durationMin: 0 }, { name: 'x', durationMin: 600 }, { name: 'x', durationMin: 30, pricePaise: -1 }]) expect(checkServiceInput(bad).ok).toBe(false);
  });
});

describe('free slots', () => {
  const hours = week([{ day: 1, start: '09:00', end: '11:00' }]);
  const now = at('2026-11-10', '08:00');
  it('are on the length grid inside the working window, in India time', () => {
    expect(freeSlots({ hours, durationMin: 30, day: MON, busy: [], nowMs: now })).toEqual(['09:00', '09:30', '10:00', '10:30'].map((h) => at(MON, h)));
  });
  it('leave out a slot that overlaps a booked or requested time, even partly', () => {
    const busy = [{ startMs: at(MON, '09:15'), endMs: at(MON, '09:45') }];
    expect(freeSlots({ hours, durationMin: 30, day: MON, busy, nowMs: now })).toEqual([at(MON, '10:00'), at(MON, '10:30')]);
  });
  it('a time that only touches the end of another is free', () => { expect(freeSlots({ hours, durationMin: 30, day: MON, busy: [{ startMs: at(MON, '09:00'), endMs: at(MON, '09:30') }], nowMs: now })[0]).toBe(at(MON, '09:30')); });
  it('never offers a time that has already started', () => { expect(freeSlots({ hours, durationMin: 30, day: MON, busy: [], nowMs: at(MON, '09:40') })).toEqual([at(MON, '10:00'), at(MON, '10:30')]); });
  it('a day with no window has no slots, and a service longer than the window fits nowhere', () => {
    expect(freeSlots({ hours, durationMin: 30, day: '2026-11-17', busy: [], nowMs: now })).toEqual([]); expect(freeSlots({ hours, durationMin: 180, day: MON, busy: [], nowMs: now })).toEqual([]);
  });
  it('knows the India day of a start time (late evening UTC is the next day here)', () => { expect(dayOfStart(Date.parse('2026-11-15T20:00:00Z'))).toBe('2026-11-16'); });
  it('overlap is half open', () => { expect(overlaps({ startMs: 0, endMs: 10 }, { startMs: 10, endMs: 20 })).toBe(false); expect(overlaps({ startMs: 0, endMs: 11 }, { startMs: 10, endMs: 20 })).toBe(true); });
});

describe('appointment states (request and confirm: nothing confirms itself)', () => {
  it.each([
    ['REQUESTED', 'CONFIRMED', true], ['REQUESTED', 'DECLINED', true], ['REQUESTED', 'CANCELLED', true], ['CONFIRMED', 'COMPLETED', true], ['CONFIRMED', 'NO_SHOW', true], ['CONFIRMED', 'CANCELLED', true],
    ['REQUESTED', 'COMPLETED', false], ['REQUESTED', 'NO_SHOW', false], ['CONFIRMED', 'DECLINED', false], ['CONFIRMED', 'REQUESTED', false], ['DECLINED', 'CONFIRMED', false], ['CANCELLED', 'CONFIRMED', false], ['COMPLETED', 'CANCELLED', false], ['NO_SHOW', 'COMPLETED', false],
  ] as const)('%s to %s is %s', (a, b, ok) => { expect(canApptMove(a, b)).toBe(ok); });
  it('CONFIRMED is reachable only from REQUESTED', () => { for (const s of APPT_STATES) expect(canApptMove(s, 'CONFIRMED')).toBe(s === 'REQUESTED'); });
});
