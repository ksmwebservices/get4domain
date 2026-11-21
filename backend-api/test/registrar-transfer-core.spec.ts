import { nextOrder, transferAuthProblem, transferMarginKey } from '../src/v3-registrar/core/registrar-core';

describe('transfer-in rules (slice 5.6e)', () => {
  it('an authorisation code is 6 to 64 printable characters with no spaces', () => {
    for (const ok of ['abc123', 'Xy7!pQ#9-zz', 'a'.repeat(64)]) expect([ok, transferAuthProblem(ok)]).toEqual([ok, null]);
    for (const bad of ['', 'abc12', 'a'.repeat(65), 'has space1', 'tab\there', 'new\nline1', 'ünïcode12', null, undefined, 123456]) expect([String(bad), transferAuthProblem(bad as never)]).toEqual([String(bad), 'AUTH_CODE_INVALID']);
  });
  it('the price book key of a transfer is the extension with a transfer prefix, kept apart from a registration margin', () => {
    expect(transferMarginKey('com')).toBe('transfer.com'); expect(transferMarginKey('co.in')).toBe('transfer.co.in');
  });
  it('a transfer in progress stays SUBMITTED while the registrar works on it; an unsure initiation can become in progress; finished orders never move', () => {
    expect(nextOrder('SUBMITTED', 'REGISTRAR_IN_PROGRESS')).toBe('SUBMITTED');
    expect(nextOrder('UNKNOWN', 'REGISTRAR_IN_PROGRESS')).toBe('SUBMITTED');
    expect(nextOrder('HELD', 'REGISTRAR_IN_PROGRESS')).toBeNull();
    expect(nextOrder('COMPLETED', 'REGISTRAR_IN_PROGRESS')).toBeNull(); expect(nextOrder('FAILED', 'REGISTRAR_IN_PROGRESS')).toBeNull();
  });
});
