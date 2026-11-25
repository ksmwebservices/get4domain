import { ConflictException, NotFoundException } from '@nestjs/common';
import { maskEmail, StaffPasswordResetService } from '../src/account-security/staff-password-reset';
import { rolesFor } from '../src/auth/guards/admin-role-matrix';

/** Website Manager lane A, item i: staff e-mail the owner a reset link; staff never set or see a password. */
const make = (vendor: { email: string } | null) => {
  const requestReset = jest.fn();
  const prisma = { vendor: { findUnique: jest.fn(async () => vendor) } };
  return { svc: new StaffPasswordResetService(prisma as never, { requestReset }), requestReset, prisma };
};

describe('staff send a password reset link', () => {
  it('asks for the normal reset to the OWNER address and answers with a masked address and no link or token', async () => {
    const { svc, requestReset } = make({ email: 'ravi.kumar@example.com' });
    const a = await svc.send('v1', '10.0.0.9');
    expect(requestReset).toHaveBeenCalledTimes(1);
    expect(requestReset).toHaveBeenCalledWith('ravi.kumar@example.com', '10.0.0.9');
    expect(a).toMatchObject({ requested: true, sentTo: 'r***@example.com' });
    expect(JSON.stringify(a)).not.toMatch(/token|password=|reset-password|ravi\.kumar/i);
  });

  it('an unknown business is a 404 and nothing is sent', async () => {
    const { svc, requestReset } = make(null);
    await expect(svc.send('nope')).rejects.toBeInstanceOf(NotFoundException);
    expect(requestReset).not.toHaveBeenCalled();
  });

  it('a business with no real owner e-mail (a listing made on behalf) is refused: use the claim link', async () => {
    for (const email of ['', 'x@sites.get4domain.invalid']) {
      const { svc, requestReset } = make({ email });
      await expect(svc.send('v1')).rejects.toBeInstanceOf(ConflictException);
      expect(requestReset).not.toHaveBeenCalled();
    }
  });

  it('masks an address to its first letter and its domain', () => {
    expect(maskEmail('a@b.in')).toBe('a***@b.in');
    expect(maskEmail('long.name@site.example')).toBe('l***@site.example');
  });

  it('only operations and super admin may use it; marketing is refused', () => {
    const roles = rolesFor('POST /v3/admin/vendors/:id/send-password-reset');
    expect([...(roles ?? [])].sort()).toEqual(['OPERATIONS', 'SUPER_ADMIN']);
  });
});
