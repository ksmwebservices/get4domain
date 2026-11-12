import { registrarWorld, RegistrarWorld, V1 } from './support/registrar-world';

/** Identity validation before the first purchase (Amendment 10 Part D3): OTPs, details, one government document, staff review, access log, retention with no default. */
let w: RegistrarWorld;
const staff = { id: 'staff-1', role: 'OPERATIONS' };
const details = { legalName: 'Meena Ravi', company: 'Sri Ganesh Traders', email: 'Meena@Example.in', phoneCc: '91', phone: '9876543210', addressLine1: '12 Main Road', city: 'Madurai', state: 'Tamil Nadu', zipcode: '625001' };
const pdf = (text = 'PAN card copy') => Buffer.from(text).toString('base64');
const doc = (over: Record<string, unknown> = {}) => ({ kind: 'PAN', mime: 'application/pdf', dataBase64: pdf(), ...over });
const codeOf = (i: number): string => w.sender.sent[i].code;

beforeEach(async () => { w = registrarWorld(); await w.open('v1'); });
const saved = () => w.identity.saveDetails('v1', details, V1);
const verifyBoth = async () => { await w.identity.sendOtp('v1', 'EMAIL', V1); await w.identity.verifyOtp('v1', 'EMAIL', codeOf(0), V1); await w.identity.sendOtp('v1', 'PHONE', V1); await w.identity.verifyOtp('v1', 'PHONE', codeOf(1), V1); };

describe('details', () => {
  it('are saved with a lowercase email and start INCOMPLETE with nothing verified', async () => {
    expect(await saved()).toMatchObject({ status: 'INCOMPLETE', emailVerified: false, phoneVerified: false, document: null, details: { email: 'meena@example.in', country: 'IN' } });
  });
  it('refuse missing or malformed values, a six digit pincode rule for India, and an Aadhaar number in ANY field', async () => {
    for (const bad of [{ legalName: '' }, { email: 'nope' }, { phone: '12' }, { phoneCc: 'ab' }, { zipcode: '62500' }, { addressLine1: 'x' }, { country: 'India' }] as const)
      await expect(w.identity.saveDetails('v1', { ...details, ...bad }, V1)).rejects.toMatchObject({ response: { code: 'IDENTITY_INVALID' } });
    for (const n of ['1234 5678 9012', '1234-5678-9012', '123456789012']) await expect(w.identity.saveDetails('v1', { ...details, addressLine1: `12 Main Road ${n}` }, V1)).rejects.toMatchObject({ response: { code: 'IDENTITY_AADHAAR_REFUSED' } });
    expect(await w.rstore.registrant('v1')).toBeNull();
  });
  it('a changed email or phone must be verified again; an unchanged save keeps both', async () => {
    await saved(); await verifyBoth();
    expect(await saved()).toMatchObject({ emailVerified: true, phoneVerified: true });
    expect(await w.identity.saveDetails('v1', { ...details, email: 'other@example.in' }, V1)).toMatchObject({ emailVerified: false, phoneVerified: true });
    expect(await w.identity.saveDetails('v1', { ...details, email: 'other@example.in', phone: '9000000001' }, V1)).toMatchObject({ phoneVerified: false });
  });
  it('any change after approval sends the check back to the start', async () => {
    await saved(); await w.rstore.patchRegistrant('v1', null, { status: 'APPROVED', consentAt: w.now.t });
    expect(await w.identity.saveDetails('v1', { ...details, city: 'Chennai' }, V1)).toMatchObject({ status: 'INCOMPLETE', consentGiven: false });
  });
});

describe('one-time codes', () => {
  it('cannot be sent until staff set how long they live and how many tries are allowed', async () => {
    await saved(); w.rsettings.v = { ...w.rsettings.v, identityOtpTtlSeconds: null };
    await expect(w.identity.sendOtp('v1', 'EMAIL', V1)).rejects.toMatchObject({ response: { code: 'OTP_NOT_AVAILABLE' } });
    expect(w.sender.sent).toHaveLength(0);
  });
  it('are six digits, stored only as a keyed hash, and verify the right channel', async () => {
    await saved(); const r = await w.identity.sendOtp('v1', 'EMAIL', V1);
    expect(r.expiresAt.getTime()).toBe(w.now.t.getTime() + 600_000); expect(w.sender.sent[0]).toMatchObject({ channel: 'EMAIL', to: 'meena@example.in', vendorId: 'v1' }); expect(codeOf(0)).toMatch(/^\d{6}$/);
    expect(JSON.stringify(w.rstore.otps)).not.toContain(codeOf(0));
    expect(await w.identity.verifyOtp('v1', 'EMAIL', codeOf(0), V1)).toMatchObject({ emailVerified: true, phoneVerified: false });
    await w.identity.sendOtp('v1', 'PHONE', V1); expect(w.sender.sent[1]).toMatchObject({ channel: 'PHONE', to: '919876543210' });
  });
  it('a wrong code counts a try; after the allowed tries even the right code fails; a code works once', async () => {
    await saved(); await w.identity.sendOtp('v1', 'EMAIL', V1); const good = codeOf(0); const wrong = good === '000000' ? '111111' : '000000';
    for (let i = 0; i < 3; i++) await expect(w.identity.verifyOtp('v1', 'EMAIL', wrong, V1)).rejects.toMatchObject({ response: { code: 'OTP_INVALID' } });
    await expect(w.identity.verifyOtp('v1', 'EMAIL', good, V1)).rejects.toMatchObject({ response: { code: 'OTP_INVALID' } });
    w.advance(31_000); await w.identity.sendOtp('v1', 'EMAIL', V1); const fresh = codeOf(1);
    await w.identity.verifyOtp('v1', 'EMAIL', fresh, V1); await expect(w.identity.verifyOtp('v1', 'EMAIL', fresh, V1)).rejects.toMatchObject({ response: { code: 'OTP_INVALID' } });
  });
  it('expire, cannot be asked for too often, and need a six digit answer', async () => {
    await saved(); await w.identity.sendOtp('v1', 'EMAIL', V1);
    await expect(w.identity.sendOtp('v1', 'EMAIL', V1)).rejects.toMatchObject({ response: { code: 'OTP_TOO_SOON' } });
    await expect(w.identity.verifyOtp('v1', 'EMAIL', 'abcdef', V1)).rejects.toMatchObject({ response: { code: 'OTP_INVALID' } });
    w.advance(601_000); await expect(w.identity.verifyOtp('v1', 'EMAIL', codeOf(0), V1)).rejects.toMatchObject({ response: { code: 'OTP_INVALID' } });
  });
  it('a code that could not be delivered is unusable and the vendor is told', async () => {
    await saved(); w.sender.fail = true;
    await expect(w.identity.sendOtp('v1', 'EMAIL', V1)).rejects.toMatchObject({ response: { code: 'OTP_DELIVERY_FAILED' } });
    expect(w.rstore.otps[0].consumedAt).not.toBeNull();
  });
  it('the production sender is not connected yet and says so', async () => {
    const { UnavailableOtpSender } = await import('../src/v3-registrar/identity.service');
    await expect(new UnavailableOtpSender().send()).rejects.toThrow('OTP_DELIVERY_NOT_CONNECTED');
  });
});

describe('the document', () => {
  it('is stored only through the crypto port: the bytes in the store are not the document', async () => {
    await saved(); const v = await w.identity.uploadDocument('v1', doc(), V1);
    expect(v.document).toMatchObject({ kind: 'PAN', last4: null, purged: false });
    const stored = w.rstore.docs.get('v1')!; expect(Buffer.from(stored.cipher).toString()).not.toContain('PAN card copy'); expect(stored.iv).toHaveLength(12); expect(stored.tag).toHaveLength(16);
    expect(w.rstore.access.map((a) => a.action)).toEqual(['DOCUMENT_UPLOADED']);
  });
  it('accepts the listed kinds only; Aadhaar only as a masked copy with exactly four digits; other kinds carry no digits', async () => {
    await saved();
    await expect(w.identity.uploadDocument('v1', doc({ kind: 'PASSPORT' }), V1)).rejects.toMatchObject({ response: { code: 'IDENTITY_INVALID' } });
    await expect(w.identity.uploadDocument('v1', doc({ kind: 'AADHAAR_MASKED' }), V1)).rejects.toMatchObject({ response: { code: 'IDENTITY_INVALID' } });
    await expect(w.identity.uploadDocument('v1', doc({ kind: 'AADHAAR_MASKED', last4: '123456789012' }), V1)).rejects.toMatchObject({ response: { code: 'IDENTITY_INVALID' } });
    await expect(w.identity.uploadDocument('v1', doc({ last4: '1234' }), V1)).rejects.toMatchObject({ response: { code: 'IDENTITY_INVALID' } });
    expect((await w.identity.uploadDocument('v1', doc({ kind: 'AADHAAR_MASKED', last4: '9012' }), V1)).document).toMatchObject({ kind: 'AADHAAR_MASKED', last4: '9012' });
  });
  it('refuses a type that is not a PDF, JPEG or PNG, bad base64, an empty file and one over the staff limit', async () => {
    await saved();
    await expect(w.identity.uploadDocument('v1', doc({ mime: 'application/zip' }), V1)).rejects.toMatchObject({ response: { code: 'IDENTITY_INVALID' } });
    await expect(w.identity.uploadDocument('v1', doc({ dataBase64: 'not base64!' }), V1)).rejects.toMatchObject({ response: { code: 'IDENTITY_INVALID' } });
    w.rsettings.v = { ...w.rsettings.v, identityDocMaxBytes: 10 };
    await expect(w.identity.uploadDocument('v1', doc({ dataBase64: pdf('this is more than ten bytes') }), V1)).rejects.toMatchObject({ response: { code: 'IDENTITY_DOCUMENT_TOO_LARGE' } });
    w.rsettings.v = { ...w.rsettings.v, identityDocMaxBytes: null };
    await expect(w.identity.uploadDocument('v1', doc(), V1)).rejects.toMatchObject({ response: { code: 'IDENTITY_STORAGE_NOT_CONFIGURED' } });
    expect(w.rstore.docs.size).toBe(0);
  });
  it('without an encryption key nothing is stored in clear', async () => {
    await saved(); w.crypto.fail = 'config';
    await expect(w.identity.uploadDocument('v1', doc(), V1)).rejects.toMatchObject({ response: { code: 'IDENTITY_STORAGE_NOT_CONFIGURED' } });
    expect(w.rstore.docs.size).toBe(0);
  });
  it('the vendor never gets the document back, only its kind and last four digits', async () => {
    await saved(); await w.identity.uploadDocument('v1', doc(), V1);
    expect(JSON.stringify(await w.identity.mine('v1'))).not.toMatch(/cipher|dataBase64|PAN card copy/);
  });
});

describe('submit and review', () => {
  const ready = async () => { await saved(); await verifyBoth(); await w.identity.uploadDocument('v1', doc(), V1); };
  it('needs both contacts verified, a document and the vendor\'s confirmation', async () => {
    await saved(); await expect(w.identity.submit('v1', true, V1)).rejects.toMatchObject({ response: { code: 'IDENTITY_STATE_INVALID' } });
    await ready(); await expect(w.identity.submit('v1', false, V1)).rejects.toMatchObject({ response: { code: 'IDENTITY_INVALID' } });
    expect(await w.identity.submit('v1', true, V1)).toMatchObject({ status: 'IN_REVIEW', consentGiven: true });
    expect(await w.identity.submit('v1', true, V1)).toMatchObject({ status: 'IN_REVIEW' });
  });
  it('a reviewer must give a reason to open the document, the access is logged BEFORE the content is returned, and a log failure returns nothing', async () => {
    await ready(); await w.identity.submit('v1', true, V1);
    await expect(w.identity.openDocument('v1', staff, 'ok')).rejects.toMatchObject({ response: { code: 'IDENTITY_REVIEW_REASON_REQUIRED' } });
    const d = await w.identity.openDocument('v1', staff, 'checking the PAN against the name');
    expect(Buffer.from(d.dataBase64, 'base64').toString()).toBe('PAN card copy');
    expect(w.rstore.access.filter((a) => a.action === 'DOCUMENT_VIEWED')).toEqual([expect.objectContaining({ staffId: 'staff-1', reason: 'checking the PAN against the name' })]);
    w.rstore.logAccess = async () => { throw new Error('log down'); };
    await expect(w.identity.openDocument('v1', staff, 'second look at it')).rejects.toThrow('log down');
  });
  it('a damaged or unreadable document is reported, not returned', async () => {
    await ready(); w.crypto.fail = 'read';
    await expect(w.identity.openDocument('v1', staff, 'checking the document')).rejects.toMatchObject({ response: { code: 'IDENTITY_DOCUMENT_UNREADABLE' } });
  });
  it('approve and reject work only on a check waiting for review; a rejection needs a reason the vendor can see; two reviewers cannot both decide', async () => {
    await ready(); await expect(w.identity.decide('v1', staff, 'APPROVED', '')).rejects.toMatchObject({ response: { code: 'IDENTITY_STATE_INVALID' } });
    await w.identity.submit('v1', true, V1);
    await expect(w.identity.decide('v1', staff, 'REJECTED', 'no')).rejects.toMatchObject({ response: { code: 'IDENTITY_REVIEW_REASON_REQUIRED' } });
    expect(await w.identity.decide('v1', staff, 'REJECTED', 'The name on the document does not match')).toMatchObject({ status: 'REJECTED', reviewNote: 'The name on the document does not match' });
    await w.identity.submit('v1', true, V1);
    const [a, b] = await Promise.allSettled([w.identity.decide('v1', staff, 'APPROVED', ''), w.identity.decide('v1', { id: 'staff-2', role: 'SUPER_ADMIN' }, 'APPROVED', '')]);
    expect([a.status, b.status].sort()).toEqual(['fulfilled', 'rejected']);
    expect(w.rstore.access.filter((x) => x.action === 'APPROVED')).toHaveLength(1);
    expect(await w.identity.mine('v1')).toMatchObject({ status: 'APPROVED', reviewNote: null });
  });
  it('uploading a new document sends an approved check back to the start', async () => {
    await ready(); await w.identity.submit('v1', true, V1); await w.identity.decide('v1', staff, 'APPROVED', '');
    expect(await w.identity.uploadDocument('v1', doc({ kind: 'UDYAM' }), V1)).toMatchObject({ status: 'INCOMPLETE', consentGiven: false });
  });
  it('the staff view lists the queue and the access log and never the document itself', async () => {
    await ready(); await w.identity.submit('v1', true, V1); await w.identity.openDocument('v1', staff, 'looking at the document');
    const q = await w.identity.queue('IN_REVIEW', 1, 25); expect(q.total).toBe(1); expect(JSON.stringify(q)).not.toMatch(/cipher|dataBase64/);
    const v = await w.identity.forStaff('v1'); expect(v.accessLog.map((a) => a.action)).toEqual(expect.arrayContaining(['DOCUMENT_UPLOADED', 'DOCUMENT_VIEWED'])); expect(JSON.stringify(v)).not.toMatch(/cipher|dataBase64/);
    await expect(w.identity.forStaff('nobody')).rejects.toMatchObject({ response: { code: 'IDENTITY_NOT_FOUND' } });
  });
});

describe('retention (set by counsel, no default)', () => {
  const decided = async () => { await saved(); await verifyBoth(); await w.identity.uploadDocument('v1', doc(), V1); await w.identity.submit('v1', true, V1); await w.identity.decide('v1', staff, 'APPROVED', ''); };
  it('nothing is ever deleted while the retention is unset', async () => {
    await decided(); w.advance(1000 * 86_400_000);
    expect(await w.identity.purgeDue()).toEqual({ purged: 0 }); expect(w.rstore.docs.size).toBe(1);
  });
  it('once set, a decided check older than the retention loses its document, is logged, and keeps its APPROVED result', async () => {
    await decided(); w.rsettings.v = { ...w.rsettings.v, identityDocRetentionDays: 30 };
    w.advance(29 * 86_400_000); expect(await w.identity.purgeDue()).toEqual({ purged: 0 });
    w.advance(2 * 86_400_000); expect(await w.identity.purgeDue()).toEqual({ purged: 1 }); expect(await w.identity.purgeDue()).toEqual({ purged: 0 });
    expect(w.rstore.docs.size).toBe(0); expect(w.rstore.access.map((a) => a.action)).toContain('DOCUMENT_PURGED');
    expect(await w.identity.mine('v1')).toMatchObject({ status: 'APPROVED', document: { purged: true } });
    await expect(w.identity.openDocument('v1', staff, 'trying after the purge')).rejects.toMatchObject({ response: { code: 'IDENTITY_DOCUMENT_NOT_SET' } });
  });
});

describe('the real encryption', () => {
  it('round trips with a key, uses a fresh IV each time, refuses to work without a key and rejects tampering', async () => {
    const { AesGcmDocCrypto, DocCryptoError } = await import('../src/v3-registrar/doc-crypto');
    const key = 'a'.repeat(64); const c = new AesGcmDocCrypto(() => ({ IDENTITY_DOC_KEY: key }));
    const a = c.encrypt(Buffer.from('secret pan')); const b = c.encrypt(Buffer.from('secret pan'));
    expect(a.iv.equals(b.iv)).toBe(false); expect(a.cipher.toString()).not.toContain('secret pan'); expect(c.decrypt(a).toString()).toBe('secret pan');
    expect(() => new AesGcmDocCrypto(() => ({})).encrypt(Buffer.from('x'))).toThrow(DocCryptoError);
    expect(() => new AesGcmDocCrypto(() => ({ IDENTITY_DOC_KEY: 'short' })).encrypt(Buffer.from('x'))).toThrow(DocCryptoError);
    a.cipher[0] ^= 1; expect(() => c.decrypt(a)).toThrow(DocCryptoError);
    expect(() => new AesGcmDocCrypto(() => ({ IDENTITY_DOC_KEY: 'b'.repeat(64) })).decrypt(b)).toThrow(DocCryptoError);
  });
});
