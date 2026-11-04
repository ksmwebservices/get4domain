import { describeSchemaSlice, migrationSql, missingColumns, modelBlock } from './support/schema-checks';

/** B2 slice 5.7: the public directory, claim by phone OTP, removal links. */
const TABLES = [
  'g4d_directory_locations', 'g4d_directory_categories', 'g4d_directory_businesses', 'g4d_directory_business_services', 'g4d_directory_business_media',
  'g4d_directory_placements', 'g4d_otp_challenges', 'g4d_directory_removal_requests', 'g4d_directory_claim_overrides', 'g4d_account_setup_grants',
];
describeSchemaSlice('slice 5.7', {
  suffix: '_v3_directory', tables: TABLES, fkTargets: ['Vendor'],
  enums: ['V3DirectoryLocationKind', 'V3DirectoryBusinessStatus', 'V3DirectoryPlacementKind', 'V3OtpChannel', 'V3OtpStatus', 'V3DirectoryRemovalStatus', 'V3GrantStatus'],
  extraAllowed: [/^ALTER TYPE "V3StepKey" ADD VALUE( IF NOT EXISTS)? 'CREATE_DIRECTORY_PROFILE'$/],
});

describe('slice 5.7 columns and rules', () => {
  it('locations and categories are trees with a slug that is unique per parent (also for the root)', () => {
    for (const t of ['g4d_directory_locations', 'g4d_directory_categories']) {
      const b = modelBlock(t);
      expect(missingColumns(b, ['parentId', 'parentKey', 'name', 'slug', 'proposed', 'active'])).toEqual([]);
      expect(b).toMatch(/@@unique\(\[parentKey, slug\]\)/);
    }
  });
  it('businesses: nullable unique vendorId, unique slug, status, indexable, masked email only, a generated search vector with a GIN index', () => {
    const b = modelBlock('g4d_directory_businesses');
    expect(missingColumns(b, ['vendorId', 'slug', 'name', 'categoryId', 'locationId', 'addressJson', 'phoneE164', 'emailMasked', 'hoursJson', 'geoJson', 'descriptionText', 'status', 'indexable', 'source', 'searchVector'])).toEqual([]);
    expect(b).toMatch(/vendorId\s+String\?\s+@unique/); expect(b).toMatch(/slug\s+String\s+@unique/);
    expect(b).not.toMatch(/\bemail\s+String/);   // no clear email on a public table
    expect(b).toMatch(/searchVector\s+Unsupported\("tsvector"\)\?/); expect(b).toMatch(/@@index\(\[searchVector\], type: Gin\)/);
    const { code } = migrationSql('_v3_directory');
    expect(code).toMatch(/"searchVector" tsvector GENERATED ALWAYS AS \(to_tsvector\('simple'/);
    expect(code).toMatch(/USING GIN \("searchVector"\)/i);
  });
  it('placements carry a required label (sponsored is always labelled)', () => {
    const b = modelBlock('g4d_directory_placements');
    expect(missingColumns(b, ['businessId', 'kind', 'startsAt', 'endsAt', 'label'])).toEqual([]);
    expect(b).toMatch(/label\s+String\s/); expect(b).not.toMatch(/label\s+String\?/);
  });
  it('OTP challenges store hashes and a per-row salt, never the phone number or the code', () => {
    const b = modelBlock('g4d_otp_challenges');
    expect(missingColumns(b, ['subjectType', 'subjectId', 'channel', 'phoneHash', 'codeHash', 'salt', 'attempts', 'maxAttempts', 'expiresAt', 'usedAt', 'requestIpHash', 'status'])).toEqual([]);
    expect(missingColumns(b, ['phone', 'phoneE164', 'code'])).toEqual(['phone', 'phoneE164', 'code']);
  });
  it('removal requests and account setup grants keep only hashes of their tokens', () => {
    expect(modelBlock('g4d_directory_removal_requests')).toMatch(/tokenHash\s+String\s+@unique/);
    expect(modelBlock('g4d_account_setup_grants')).toMatch(/tokenHash\s+String\s+@unique/);
    expect(missingColumns(modelBlock('g4d_directory_removal_requests'), ['status', 'reason', 'requesterContactMasked', 'handledByStaffId'])).toEqual([]);
  });
  it('the pg_trgm extension is created only inside a guarded block, so a role without permission still passes the migration (search then uses full text only)', () => {
    const { code } = migrationSql('_v3_directory');
    expect(code).toMatch(/DO \$\$[\s\S]*CREATE EXTENSION IF NOT EXISTS pg_trgm[\s\S]*EXCEPTION[\s\S]*END \$\$;/);
    expect(code).not.toMatch(/^CREATE EXTENSION/m);
  });
});
