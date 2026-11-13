import { PLACEHOLDER_BODY, TERMS_KINDS, acceptanceMatches, canEdit, canPublish, isPlaceholder, isTermsKind, outstanding, PublishedRef, TermsKind } from '../src/terms/core/terms-core';

describe('terms core', () => {
  describe('isPlaceholder', () => {
    it.each([PLACEHOLDER_BODY, '  To be supplied by counsel  ', '# To be supplied by counsel.', '- *TO BE SUPPLIED BY COUNSEL*', '> to be   supplied\nby counsel', '', '   ', '## Vendor terms\n\nTo be supplied by counsel'])('treats %j as the placeholder', (b) => {
      expect(isPlaceholder(b)).toBe(true);
    });
    it('accepts real text', () => { expect(isPlaceholder('# Terms\n\nThe business agrees to list only true information.')).toBe(false); });
  });

  describe('canPublish', () => {
    const draft = { status: 'DRAFT' as const, bodyMarkdown: 'Real text of the terms of service.' };
    it('needs a draft, real text and a change note of at least 5 characters', () => {
      expect(canPublish(draft, 'First version')).toEqual({ ok: true });
      expect(canPublish({ ...draft, bodyMarkdown: PLACEHOLDER_BODY }, 'First version')).toEqual({ ok: false, reason: 'PLACEHOLDER' });
      expect(canPublish(draft, '')).toEqual({ ok: false, reason: 'NO_CHANGE_NOTE' });
      expect(canPublish(draft, 'abc')).toEqual({ ok: false, reason: 'NO_CHANGE_NOTE' });
      expect(canPublish(draft, undefined)).toEqual({ ok: false, reason: 'NO_CHANGE_NOTE' });
      expect(canPublish({ ...draft, status: 'PUBLISHED' }, 'First version')).toEqual({ ok: false, reason: 'NOT_DRAFT' });
      expect(canPublish({ ...draft, status: 'RETIRED' }, 'First version')).toEqual({ ok: false, reason: 'NOT_DRAFT' });
    });
    it('only a draft can be edited', () => { expect([canEdit({ status: 'DRAFT' }), canEdit({ status: 'PUBLISHED' }), canEdit({ status: 'RETIRED' })]).toEqual([true, false, false]); });
  });

  describe('outstanding and acceptanceMatches', () => {
    const latest = new Map<TermsKind, PublishedRef>([['VENDOR_TERMS', { documentId: 'd2', kind: 'VENDOR_TERMS', version: 2 }], ['ACCEPTABLE_USE', { documentId: 'a1', kind: 'ACCEPTABLE_USE', version: 1 }]]);
    it('asks again for a new version even when an older one was accepted, and asks nothing for a kind with nothing published', () => {
      expect(outstanding(['VENDOR_TERMS', 'ACCEPTABLE_USE', 'DATA_PROCESSING'], latest, new Set(['d1', 'a1']))).toEqual([{ kind: 'VENDOR_TERMS', version: 2, documentId: 'd2' }]);
      expect(outstanding(['VENDOR_TERMS', 'ACCEPTABLE_USE', 'DATA_PROCESSING'], latest, new Set(['d2', 'a1']))).toEqual([]);
      expect(outstanding(['DATA_PROCESSING'], latest, new Set())).toEqual([]);
    });
    it('what is accepted must be exactly the waiting versions', () => {
      const w = [{ kind: 'VENDOR_TERMS' as const, version: 2, documentId: 'd2' }, { kind: 'ACCEPTABLE_USE' as const, version: 1, documentId: 'a1' }];
      expect(acceptanceMatches([{ kind: 'VENDOR_TERMS', version: 2 }, { kind: 'ACCEPTABLE_USE', version: 1 }], w)).toEqual({ ok: true });
      expect(acceptanceMatches([{ kind: 'VENDOR_TERMS', version: 1 }, { kind: 'ACCEPTABLE_USE', version: 1 }], w).ok).toBe(false);   // stale version
      expect(acceptanceMatches([{ kind: 'VENDOR_TERMS', version: 2 }], w).ok).toBe(false);                                            // one missing
      expect(acceptanceMatches([{ kind: 'VENDOR_TERMS', version: 2 }, { kind: 'ACCEPTABLE_USE', version: 1 }, { kind: 'PRIVACY', version: 1 }], w).ok).toBe(false);   // something not waiting
      expect(acceptanceMatches([{ kind: 'VENDOR_TERMS', version: 2 }, { kind: 'VENDOR_TERMS', version: 2 }], w).ok).toBe(false);     // twice
      expect(acceptanceMatches([], w).ok).toBe(false);
    });
  });

  it('knows the sixteen kinds, including every document of the legal pack (Block 4b)', () => {
    for (const k of ['TERMS_OF_SERVICE', 'REFUND_WALLET', 'DOMAIN_TERMS', 'ENQUIRY_CONSENT', 'IDENTITY_NOTICE', 'MESSAGING', 'TESTIMONIAL', 'DIRECTORY']) expect(isTermsKind(k)).toBe(true);
    expect(TERMS_KINDS).toHaveLength(16);
  });
  it('a draft with unfilled square-bracket placeholders is a placeholder and cannot be published; a link or a bare number is not one', () => {
    expect(isPlaceholder('We, [Company name], agree to the terms below.')).toBe(true); expect(isPlaceholder('Contact [Grievance Officer name] at the address.')).toBe(true);
    expect(isPlaceholder('Real text with a [link](https://example.com) and a note [1].')).toBe(false); expect(isPlaceholder('Real text with no brackets.')).toBe(false);
    expect(canPublish({ status: 'DRAFT', bodyMarkdown: 'Text with [a placeholder] left in it.' }, 'Counsel reviewed')).toEqual({ ok: false, reason: 'PLACEHOLDER' }); expect(canPublish({ status: 'DRAFT', bodyMarkdown: 'Finished text.' }, 'Counsel reviewed')).toEqual({ ok: true });
  });
  it('knows the eight original kinds', () => {
    for (const k of ['VENDOR_TERMS', 'ACCEPTABLE_USE', 'DATA_PROCESSING', 'REFUND_POLICY_TEMPLATE', 'GRIEVANCE', 'PRIVACY', 'COOKIE', 'CUSTOMER_TERMS']) expect(isTermsKind(k)).toBe(true);
    expect([isTermsKind('NOPE'), isTermsKind(undefined), isTermsKind('vendor_terms')]).toEqual([false, false, false]);
  });
});
