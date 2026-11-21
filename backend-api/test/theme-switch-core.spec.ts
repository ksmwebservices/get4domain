import { countsAsSwitch, feeDecision, hiddenFields, usedFieldsOfTemplates } from '../src/v3-theme-switch/core/theme-switch-core';

/**
 * Slice 5.16d: the pure rules of the Theme Switch Service (owner rule 4): the first switch is included in Pro, every later one is charged, a staff gift and a restore are neither, and nothing the vendor
 * wrote is ever removed. Nothing here knows a price, a clock or a database.
 */
const applied = (kind: 'FREE_INCLUDED' | 'PAID' | 'COMPLIMENTARY_STAFF' | 'RESTORE') => ({ kind, status: 'APPLIED' as const });
const D = { restore: false, staffComplimentary: false };

describe('the fee decision', () => {
  it('a vendor with no earlier switch gets the included one (the first Pro theme, also the one made at the Free to Pro upgrade)', () => { expect(feeDecision([], D)).toEqual({ kind: 'FREE_INCLUDED' }); });
  it('after that, every switch is paid, however many have been made and however long ago (a renewal never gives another free one)', () => {
    expect(feeDecision([applied('FREE_INCLUDED')], D)).toEqual({ kind: 'PAID' });
    expect(feeDecision([applied('FREE_INCLUDED'), applied('PAID'), applied('PAID')], D)).toEqual({ kind: 'PAID' });
    expect(feeDecision([applied('PAID')], D)).toEqual({ kind: 'PAID' });   // a vendor whose first switch was somehow paid has still used their included one
  });
  it('a restore after a lapse and a renewal is free and is not a switch: it neither uses the included one nor becomes a paid one', () => {
    expect(feeDecision([applied('FREE_INCLUDED'), applied('PAID')], { ...D, restore: true })).toEqual({ kind: 'RESTORE' });
    expect(feeDecision([], { ...D, restore: true })).toEqual({ kind: 'RESTORE' });
    expect(feeDecision([applied('RESTORE'), applied('RESTORE')], D)).toEqual({ kind: 'FREE_INCLUDED' });
  });
  it('a staff gift is free, does not use up the vendor\'s included switch, and does not count as a paid one', () => {
    expect(feeDecision([], { ...D, staffComplimentary: true })).toEqual({ kind: 'COMPLIMENTARY_STAFF' });
    expect(feeDecision([applied('COMPLIMENTARY_STAFF')], D)).toEqual({ kind: 'FREE_INCLUDED' });
    expect(feeDecision([applied('FREE_INCLUDED'), applied('COMPLIMENTARY_STAFF')], D)).toEqual({ kind: 'PAID' });
  });
  it('a switch that never happened (pending or failed) does not count: the vendor is not charged for a failure and does not lose the included one', () => {
    expect(feeDecision([{ kind: 'FREE_INCLUDED', status: 'FAILED' }], D)).toEqual({ kind: 'FREE_INCLUDED' });
    expect(feeDecision([{ kind: 'PAID', status: 'FAILED' }, { kind: 'PAID', status: 'PENDING' }], D)).toEqual({ kind: 'FREE_INCLUDED' });
    expect(feeDecision([applied('FREE_INCLUDED'), { kind: 'PAID', status: 'FAILED' }], D)).toEqual({ kind: 'PAID' });
  });
  it('a restore wins over a gift flag, and only the two kinds that are real switches count', () => {
    expect(feeDecision([], { restore: true, staffComplimentary: true })).toEqual({ kind: 'RESTORE' });
    expect([countsAsSwitch('FREE_INCLUDED'), countsAsSwitch('PAID'), countsAsSwitch('COMPLIMENTARY_STAFF'), countsAsSwitch('RESTORE')]).toEqual([true, true, false, false]);
  });
});

describe('what a theme draws and what it leaves hidden (nothing is removed, only listed)', () => {
  it('finds the content a theme\'s templates draw: slots, repeaters and conditions, by their first name', () => {
    const used = usedFieldsOfTemplates(['<h1>{{site.name}}</h1><p>{{ contact.phone }}</p>', '<ul data-g4d-each="items"><li>{{name}}</li></ul>', '<section data-g4d-if="testimonials"><div data-g4d-each="testimonials">{{quote}}</div></section>']);
    expect([...used].sort()).toEqual(['contact', 'items', 'name', 'quote', 'site', 'testimonials']);
  });
  it('takes no notice of markup that is not a slot, and handles no templates', () => {
    expect([...usedFieldsOfTemplates(['<p class="a">plain</p>', '{{ }}', '{{ 5 }}'])]).toEqual([]); expect([...usedFieldsOfTemplates([])]).toEqual([]);
  });
  it('the hidden fields are the vendor\'s fields the new theme does not draw, sorted, once each', () => {
    expect(hiddenFields(['site', 'items', 'faqs', 'team', 'faqs'], new Set(['site', 'items']))).toEqual(['faqs', 'team']);
    expect(hiddenFields(['site'], new Set(['site', 'items']))).toEqual([]);
  });
  it('when the theme\'s use of fields cannot be worked out there is nothing to claim is hidden', () => { expect(hiddenFields(['site', 'items'], null)).toEqual([]); });
  it('switching back shows them again: the list is a pure function of the two sets, so the same theme gives the same answer', () => {
    const fields = ['site', 'items', 'faqs', 'team']; const a = new Set(['site', 'items', 'faqs', 'team']); const b = new Set(['site', 'items']);
    expect(hiddenFields(fields, b)).toEqual(['faqs', 'team']); expect(hiddenFields(fields, a)).toEqual([]); expect(hiddenFields(fields, b)).toEqual(['faqs', 'team']);
  });
});
