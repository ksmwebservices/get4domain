import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { VendorOwnerGuard } from '../src/common/guards/vendor-owner.guard';
import { REQUIRES_FEATURE } from '../src/plans/entitlements/requires-feature.decorator';
import { MeAccountsController, MeItemsController } from '../src/v3-accounts/api/accounts.controllers';
import { MeJobsController, MeQuotesController } from '../src/v3-jobs/api/jobs.controllers';

/**
 * Free locked, and the right tracks only: every accounts route sits behind a plan feature (the entitlement decision table in b13-entitlements.spec.ts says what Free and Pro get for each) and is
 * owner only. Items and services use their own feature, which the plan seed gives to Handyman and Professional only.
 */
const guards = (c: object): unknown[] => Reflect.getMetadata(GUARDS_METADATA, c) ?? [];
describe('accounts routes are gated', () => {
  it('books, expenses and the GST summary require accounts.books and the owner', () => {
    expect(Reflect.getMetadata(REQUIRES_FEATURE, MeAccountsController)).toEqual({ key: 'accounts.books' });
    expect(guards(MeAccountsController)).toContain(VendorOwnerGuard);
  });
  it('items and services require accounts.items and the owner', () => {
    expect(Reflect.getMetadata(REQUIRES_FEATURE, MeItemsController)).toEqual({ key: 'accounts.items' });
    expect(guards(MeItemsController)).toContain(VendorOwnerGuard);
  });
  it('jobs and quotes require jobs.manage and the owner', () => {
    for (const c of [MeJobsController, MeQuotesController]) { expect(Reflect.getMetadata(REQUIRES_FEATURE, c)).toEqual({ key: 'jobs.manage' }); expect(guards(c)).toContain(VendorOwnerGuard); }
  });
  it('no method opts out of the class gate with its own feature or a public marker', () => {
    for (const c of [MeAccountsController, MeItemsController, MeJobsController, MeQuotesController]) for (const name of Object.getOwnPropertyNames(c.prototype).filter((n) => n !== 'constructor')) {
      expect([name, Reflect.getMetadata(REQUIRES_FEATURE, (c.prototype as unknown as Record<string, object>)[name])]).toEqual([name, undefined]);
      expect([name, Reflect.getMetadata('isPublic', (c.prototype as unknown as Record<string, object>)[name])]).toEqual([name, undefined]);
    }
  });
});
