import { PLACEHOLDER_BODY, TermsKind, VENDOR_REQUIRED_KINDS } from '../../src/terms/core/terms-core';
import { TermsService } from '../../src/terms/terms.service';
import { OtpPepper } from '../../src/directory/pepper';
import { Actor } from '../../src/plans/admin/audit.service';
import { seedTermsDrafts } from '../../src/terms/seed/terms-seed';
import { MemoryTermsStore } from './memory-terms-store';

export const STAFF: Actor = { type: 'STAFF', id: 'staff-super', ip: '10.0.0.1' };
export const REAL_TEXT = '# Vendor terms\n\nThese are the working terms agreed between the business and the platform. They are long enough to be real text for a test.';

/** A terms module over the in-memory store: nothing published yet, every kind seeded as a placeholder DRAFT (as the loader does). */
export async function termsWorld(opts: { seed?: boolean } = {}) {
  const store = new MemoryTermsStore();
  let t = Date.parse('2026-11-04T10:00:00Z');
  const clock = () => new Date(t);
  store.clock = clock;
  const pepper = new OtpPepper(); pepper.env = { OTP_HASH_PEPPER: 'unit-test-pepper' };
  const svc = new TermsService(store, pepper); svc.clock = clock;
  if (opts.seed !== false) await seedTermsDrafts(store, { apply: true });

  const draftOf = async (kind: TermsKind) => (await store.listDocuments({ kind })).find((d) => d.status === 'DRAFT')!;
  /** write real text into the kind's draft and publish it */
  const publish = async (kind: TermsKind, text = REAL_TEXT, note = 'First version') => {
    let d = (await store.listDocuments({ kind })).find((x) => x.status === 'DRAFT');
    if (!d) d = await svc.createDraft(kind, { bodyMarkdown: text }, STAFF) as never;
    await svc.updateDraft(d!.id, { bodyMarkdown: text }, STAFF);
    return svc.publish(d!.id, note, STAFF);
  };
  const publishRequired = async (note = 'First version') => { for (const k of VENDOR_REQUIRED_KINDS) await publish(k, REAL_TEXT, note); };
  const acceptAll = async (vendorId: string, userId: string | null = 'u1') => {
    const s = await svc.status(vendorId);
    return svc.accept(vendorId, userId, s.outstanding, { ip: '203.0.113.9', userAgent: 'jest' }, { type: 'VENDOR', id: userId, ip: '203.0.113.9' });
  };
  return { store, svc, clock, advance: (ms: number) => { t += ms; }, draftOf, publish, publishRequired, acceptAll, PLACEHOLDER_BODY };
}
export type TW = Awaited<ReturnType<typeof termsWorld>>;
