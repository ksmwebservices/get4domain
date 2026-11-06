import { LEGACY_MODELS, migrationSql, missingColumns, modelBlock, schemaText } from './support/schema-checks';

/**
 * Batch 4B slice 5.20: the activity log, alert rules, alerts and in-app notifications. No database here: the migration text and the Prisma models are checked, and the staging suite
 * (activity.int.spec.ts, NOT RUN without a staging database) proves the trigger and the constraints. The notifications table is g4d_v3_notifications because g4d_notifications is the
 * LEGACY notification table (decision D1: V3 never reads or writes legacy tables).
 */
const m = migrationSql('_v3_activity_alerts');
const TABLES = ['g4d_activity_log', 'g4d_alert_rules', 'g4d_alerts', 'g4d_v3_notifications'];

describe('slice 5.20: migration folder', () => {
  it('is the folder right after the refill tax folder, and holds exactly the four tables', () => {
    expect(m.name).toBe('20261123100000_v3_activity_alerts');
    expect(m.code.match(/CREATE TABLE/g)).toHaveLength(4);
    for (const t of TABLES) { expect(m.code).toContain(`CREATE TABLE "${t}"`); expect(m.code).toContain(`ALTER TABLE "${t}" ENABLE ROW LEVEL SECURITY`); }
  });
  it('is additive: no DROP, RENAME, TRUNCATE, DELETE FROM, UPDATE of a row or ALTER COLUMN', () => { expect(m.code).not.toMatch(/\bDROP\b|\bTRUNCATE\b|\bRENAME\b|\bDELETE\s+FROM\b|\bUPDATE\s+"|\bALTER COLUMN\b/i); });
  it('every statement outside the function body is a CREATE TYPE, TABLE or INDEX, an ADD CONSTRAINT, a TRIGGER or ENABLE ROW LEVEL SECURITY', () => {
    const outside = m.code.replace(/CREATE OR REPLACE FUNCTION[\s\S]*?\$\$ LANGUAGE plpgsql;/g, '');
    for (const stmt of outside.split(';').map((x) => x.trim()).filter(Boolean)) expect([stmt.slice(0, 70), /^(CREATE TYPE|CREATE TABLE|CREATE (UNIQUE )?INDEX|CREATE TRIGGER|ALTER TABLE "g4d_[a-z_0-9]+" (ADD CONSTRAINT|ENABLE ROW LEVEL SECURITY))/.test(stmt)]).toEqual([stmt.slice(0, 70), true]);
  });
  it('has no foreign key at all: the log and the alerts outlive the vendor row they describe', () => { expect(m.code).not.toMatch(/REFERENCES/); });
  it('never creates or alters the legacy notifications table (g4d_notifications)', () => { expect(m.code).not.toMatch(/"g4d_notifications"/); });
  it('the enums exist and no model relates to a legacy model', () => {
    for (const e of ['V3ActivityActorType', 'V3AlertLevel', 'V3AlertStatus']) expect(schemaText).toMatch(new RegExp(`^enum ${e} \\{`, 'm'));
    for (const t of TABLES) for (const l of [...LEGACY_MODELS, 'Notification']) expect(modelBlock(t)).not.toMatch(new RegExp(`\\b${l}\\b`));
  });
});

describe('slice 5.20: the models', () => {
  it('every table has a cuid id', () => { for (const t of TABLES) expect(modelBlock(t)).toMatch(/\bid\s+String\s+@id\s+@default\(cuid\(\)\)/); });
  it('the activity log keeps who, what, on which entity, a masked summary, a hashed address and the time, with the two indexes of the dispatch', () => {
    const b = modelBlock('g4d_activity_log');
    expect(missingColumns(b, ['vendorId', 'actorType', 'actorId', 'actionKey', 'entityType', 'entityId', 'summaryJson', 'ipHash', 'at'])).toEqual([]);
    expect(b).toMatch(/vendorId\s+String\?/); expect(b).toMatch(/@@index\(\[vendorId, at\]\)/); expect(b).toMatch(/@@index\(\[actionKey, at\]\)/);
    expect(b).not.toMatch(/\bip\s+String/);   // the raw address is never stored, only its hash
    expect(b).not.toMatch(/updatedAt/);        // append-only: nothing to update
  });
  it('the alert rule has a unique key, a level, optional thresholds, roles, and is DISABLED by default', () => {
    const b = modelBlock('g4d_alert_rules');
    expect(missingColumns(b, ['key', 'level', 'thresholdJson', 'notifyRoles', 'enabled'])).toEqual([]);
    expect(b).toMatch(/key\s+String\s+@unique/); expect(b).toMatch(/thresholdJson\s+Json\?/); expect(b).toMatch(/enabled\s+Boolean\s+@default\(false\)/);
  });
  it('the alert keeps vendor, rule, level, status starting as NEW, owner, activity ids, time of creation and resolution, and a note', () => {
    const b = modelBlock('g4d_alerts');
    expect(missingColumns(b, ['vendorId', 'ruleKey', 'level', 'status', 'ownerStaffId', 'activityIds', 'createdAt', 'resolvedAt', 'note'])).toEqual([]);
    expect(b).toMatch(/status\s+V3AlertStatus\s+@default\(NEW\)/);
  });
  it('the enums are exactly the owner\'s words', () => {
    const body = (e: string): string[] => new RegExp(`^enum ${e} \\{([\\s\\S]*?)\\}`, 'm').exec(schemaText)![1].split('\n').map((l) => l.trim()).filter(Boolean);
    expect(body('V3ActivityActorType')).toEqual(['VENDOR_USER', 'STAFF', 'SYSTEM']);
    expect(body('V3AlertLevel')).toEqual(['HIGH', 'MEDIUM', 'LOW']);
    expect(body('V3AlertStatus')).toEqual(['NEW', 'LOOKING', 'RESOLVED', 'NOT_AN_ISSUE']);
  });
  it('the notification is in-app only: a user or a role, a kind, a reference and when it was read', () => {
    expect(missingColumns(modelBlock('g4d_v3_notifications'), ['userId', 'role', 'kind', 'refId', 'readAt'])).toEqual([]);
  });
});

describe('slice 5.20: rules the database enforces', () => {
  it('refuses every change and every delete of an activity row while the vendor exists', () => {
    expect(m.code).toContain('CREATE OR REPLACE FUNCTION g4d_activity_log_immutable()');
    expect(m.code).toMatch(/BEFORE UPDATE OR DELETE ON "g4d_activity_log" FOR EACH ROW/);
    expect(m.code).toContain("RAISE EXCEPTION 'g4d_activity_log rows cannot be changed'");
    expect(m.code).toContain("RAISE EXCEPTION 'g4d_activity_log rows cannot be deleted'");
  });
  it('refuses a notification for nobody, and a closed alert with no closing time (or a closing time on an open one)', () => {
    expect(m.code).toMatch(/"g4d_v3_notifications_target_chk" CHECK \("userId" IS NOT NULL OR "role" IS NOT NULL\)/);
    expect(m.code).toMatch(/"g4d_alerts_resolved_chk" CHECK \(\("status" IN \('RESOLVED', 'NOT_AN_ISSUE'\) AND "resolvedAt" IS NOT NULL\) OR \("status" IN \('NEW', 'LOOKING'\) AND "resolvedAt" IS NULL\)\)/);
  });
});
