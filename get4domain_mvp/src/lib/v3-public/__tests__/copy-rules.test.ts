import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { REGISTERED_CODES } from '../claim';
import { LEGAL_DOC_KEYS, LEGAL_SLUGS, messageForCode, S } from '../strings';

/** Every string in the strings module, including the output of the functions (called with sample arguments). */
function collect(node: unknown, out: string[] = [], path = 'S'): Array<{ path: string; text: string }> {
  const found: Array<{ path: string; text: string }> = [];
  const walk = (n: unknown, p: string): void => {
    if (typeof n === 'string') found.push({ path: p, text: n });
    else if (typeof n === 'function') {
      const fn = n as (...a: unknown[]) => unknown;
      const r = fn('Sample Name', 2, 3);
      if (typeof r === 'string') found.push({ path: `${p}()`, text: r });
    } else if (Array.isArray(n)) n.forEach((v, i) => walk(v, `${p}[${i}]`));
    else if (n && typeof n === 'object') for (const [k, v] of Object.entries(n)) walk(v, `${p}.${k}`);
  };
  walk(node, path);
  void out;
  return found;
}

const ALL = collect(S);

describe('copy rules (all visible text is in the strings module)', () => {
  test('the module has text to check', () => {
    assert.ok(ALL.length > 150, `only ${ALL.length} strings found`);
  });

  test('never the words workspace, BOS or LeadSpace', () => {
    for (const { path, text } of ALL) assert.doesNotMatch(text, /\b(workspace|bos|lead\s?space)\b/i, `${path}: ${text}`);
  });

  test('"enquiries", never "leads"', () => {
    for (const { path, text } of ALL) assert.doesNotMatch(text, /\bleads?\b/i, `${path}: ${text}`);
  });

  test('no timeframes', () => {
    const frame = /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|a|an|few|several|next|every|each)\s+(second|minute|hour|day|week|month|year)s?\b|\b(within|daily|weekly|monthly|yearly|annually|annual|immediately|instantly|overnight|real[- ]time)\b/i;
    for (const { path, text } of ALL) assert.doesNotMatch(text, frame, `${path}: ${text}`);
  });

  test('no ranking claims and no guarantees', () => {
    for (const { path, text } of ALL) assert.doesNotMatch(text, /\b(best|top[- ]rated|top(?!-up)|number one|no\.? ?1|#1|guaranteed?|leading|ranked?|star ratings?|customer reviews?|\d+ stars?|rated)\b/i, `${path}: ${text}`);
  });

  test('no price, no phone number, no email address, no messaging link', () => {
    for (const { path, text } of ALL) {
      assert.doesNotMatch(text, /₹|\brs\.?\s?\d|\binr\b|\busd\b|\$\s?\d/i, `${path}: ${text}`);
      assert.doesNotMatch(text, /\+?\d[\d\s-]{8,}\d/, `${path}: ${text}`);
      assert.doesNotMatch(text, /[^\s@]+@[^\s@]+\.[^\s@]+/, `${path}: ${text}`);
      assert.doesNotMatch(text, /tel:|mailto:|wa\.me|whatsapp/i, `${path}: ${text}`);
    }
  });

  test('no placeholder text and no production address', () => {
    for (const { path, text } of ALL) {
      assert.doesNotMatch(text, /\[[A-Za-z ]+\]|lorem|todo|tbd|get4domain\.com/i, `${path}: ${text}`);
    }
  });

  test('prices exclude GST wherever plans are named', () => {
    const plans = ALL.filter((s) => /\bplan\b/i.test(s.text) && /\bprices?\b/i.test(s.text));
    assert.ok(plans.length > 0);
    for (const { path, text } of plans) assert.match(text, /exclude GST/i, `${path}: ${text}`);
  });

  test('the Free and Pro definitions match the product rules wherever they appear', () => {
    const defs = ALL.filter((s) => /\bFree site\b/.test(s.text));
    assert.ok(defs.length >= 2);
    for (const { path, text } of defs) assert.match(text, /informational listing/i, `${path}: ${text}`);
    const pro = ALL.filter((s) => /\bPro means\b/.test(s.text));
    assert.ok(pro.length >= 2);
    for (const { path, text } of pro) assert.match(text, /Pro means any of the Pro plans/, `${path}: ${text}`);
  });

  test('the wallet text says no refunds and no cash-out', () => {
    const w = JSON.stringify(S.legal.docs.wallet);
    assert.match(w, /not refunded/i);
    assert.match(w, /cannot be withdrawn/i);
  });
});

describe('legal pages', () => {
  test('there are five, each with a slug, a summary and sections', () => {
    assert.equal(LEGAL_DOC_KEYS.length, 5);
    assert.equal(new Set(Object.values(LEGAL_SLUGS)).size, 5);
    for (const k of LEGAL_DOC_KEYS) {
      const d = S.legal.docs[k];
      assert.ok(d.title && d.summary && d.sections.length >= 4, k);
    }
  });

  test('the draft banner says the text awaits review', () => {
    assert.match(S.legal.draftBanner, /draft/i);
    assert.match(S.legal.draftBanner, /review/i);
  });
});

describe('error messages', () => {
  test('every registered backend code has a plain message and unknown codes fall back to the generic one', () => {
    for (const code of REGISTERED_CODES) {
      const m = messageForCode(code);
      assert.notEqual(m, S.errors.generic, `${code} has no message`);
      assert.ok(m.length > 10);
    }
    assert.equal(messageForCode('SOMETHING_ELSE'), S.errors.generic);
    assert.equal(messageForCode(null), S.errors.generic);
  });

  test('a rate limit is a rate limit whatever the code', () => {
    assert.equal(messageForCode('OTP_INVALID', 429), S.errors.rateLimited);
  });
});
