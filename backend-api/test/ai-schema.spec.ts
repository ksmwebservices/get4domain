import { describeSchemaSlice, missingColumns, modelBlock } from './support/schema-checks';

/** B2 slice 5.11: AI Studio providers (secrets encrypted), usage and credits, versioned prompts, manual credit grants. */
describeSchemaSlice('slice 5.11', {
  suffix: '_v3_ai_studio', tables: ['g4d_ai_providers', 'g4d_ai_usage', 'g4d_ai_prompts', 'g4d_ai_credit_grants'],
  enums: ['V3AiProviderKind', 'V3AiProviderStatus', 'V3AiUsageStatus', 'V3AiPromptStatus'], fkTargets: ['Vendor'],
});

describe('slice 5.11 columns and rules', () => {
  it('providers: a unique key, a kind, a status, the secret as ciphertext + iv + tag (never in clear), only the last 4 characters for display, a model name', () => {
    const b = modelBlock('g4d_ai_providers');
    expect(missingColumns(b, ['key', 'kind', 'displayName', 'status', 'secretCipher', 'secretIv', 'secretTag', 'secretLast4', 'model', 'settingsJson', 'createdByStaffId'])).toEqual([]);
    expect(b).toMatch(/key\s+String\s+@unique/); expect(missingColumns(b, ['secret', 'apiKey', 'secretPlain'])).toEqual(['secret', 'apiKey', 'secretPlain']);
  });
  it('usage: integer credits, tokens, an idempotency key unique per vendor, a status, the period it counts in', () => {
    const b = modelBlock('g4d_ai_usage');
    expect(missingColumns(b, ['vendorId', 'featureKey', 'providerKey', 'credits', 'inputTokens', 'outputTokens', 'idempotencyKey', 'status', 'period', 'resultText'])).toEqual([]);
    expect(b).toMatch(/credits\s+Int\b/); expect(b).toMatch(/@@unique\(\[vendorId, idempotencyKey\]\)/);
  });
  it('prompts: versioned per key, one ACTIVE per key at the database level, who created it', () => {
    const b = modelBlock('g4d_ai_prompts');
    expect(missingColumns(b, ['key', 'version', 'template', 'status', 'activeKey', 'createdByStaffId'])).toEqual([]); expect(b).toMatch(/@@unique\(\[key, version\]\)/); expect(b).toMatch(/activeKey\s+String\?\s+@unique/);
  });
  it('credit grants: who, why, how many, which month', () => { expect(missingColumns(modelBlock('g4d_ai_credit_grants'), ['vendorId', 'credits', 'reason', 'grantedByStaffId', 'period'])).toEqual([]); });
});
