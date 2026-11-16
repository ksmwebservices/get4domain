'use strict';
/**
 * The rules of the one-time bootstrap of the first SUPER_ADMIN (job L4). Pure apart from the prisma client, the prompts and the hasher that are passed in, so a test can drive it.
 *
 * The platform's first administrator is a Vendor row with role SUPER_ADMIN (the "bootstrap admin": see the AdminRole comment in schema.prisma). This creates exactly one, and ONLY when no administrator
 * exists. The email and the password come from the two prompts and from nowhere else: never an argument, an environment variable or a file. The password is never printed, logged or kept; only its bcrypt
 * hash is stored. Nothing here writes the email or the hash to the output either.
 */
const EMAIL_RE = /^[^\s@<>"]{1,64}@[^\s@<>"]{1,255}\.[^\s@<>"]{2,}$/;
const MAX_TRIES = 3;
const MIN_LENGTH = 12;
const MAX_LENGTH = 72;   // bcrypt reads at most 72 bytes: a longer password would be silently cut short

/** null when the password is acceptable. The words never repeat the password. */
function passwordProblem(password, email) {
  if (typeof password !== 'string' || password.length < MIN_LENGTH) return `The password must be at least ${MIN_LENGTH} characters.`;
  if (Buffer.byteLength(password) > MAX_LENGTH) return `The password must be at most ${MAX_LENGTH} characters.`;
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) return 'The password needs a lower case letter, a capital letter and a number.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'The password needs a symbol such as ! or - or #.';
  const local = String(email || '').split('@')[0].toLowerCase();
  if (local.length >= 4 && password.toLowerCase().includes(local)) return 'The password must not contain the email name.';
  if (/^(.)\1+$/.test(password)) return 'The password is too simple.';
  return null;
}

/** Any administrator at all: a vendor account that is SUPER_ADMIN or ADMIN (both are full staff at sign-in), or a staff member who is SUPER_ADMIN and not removed. */
async function administratorExists(db) {
  const vendors = await db.vendor.count({ where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] } } });
  if (vendors > 0) return true;
  const staff = await db.adminTeamMember.count({ where: { role: 'SUPER_ADMIN', status: { not: 'removed' } } });
  return staff > 0;
}

/**
 * @param {{ prisma: any, ask: (q: string) => Promise<string>, askSecret: (q: string) => Promise<string>, hash: (pw: string) => Promise<string>, say?: (s: string) => void }} deps
 * @returns {Promise<{ ok: boolean, reason?: 'EXISTS' | 'INVALID_EMAIL' | 'INVALID_PASSWORD' | 'MISMATCH' | 'EMAIL_TAKEN' }>}
 */
async function bootstrapSuperAdmin({ prisma, ask, askSecret, hash, say = () => undefined }) {
  // 1. refuse BEFORE asking anything when an administrator exists
  if (await administratorExists(prisma)) { say('An administrator already exists. Nothing was created. Use the admin app to add staff.'); return { ok: false, reason: 'EXISTS' }; }

  // 2. the email
  let email = '';
  for (let i = 0; i < MAX_TRIES && !email; i++) {
    const e = String(await ask('Email address of the first SUPER_ADMIN: ')).trim().toLowerCase();
    if (EMAIL_RE.test(e) && e.length <= 254) email = e; else say('That does not look like an email address.');
  }
  if (!email) return { ok: false, reason: 'INVALID_EMAIL' };

  // 3. the password, typed twice
  let password = '';
  let mismatch = false;
  for (let i = 0; i < MAX_TRIES && !password; i++) {
    const p = await askSecret('Password (not shown): ');
    const why = passwordProblem(p, email);
    if (why) { say(why); continue; }
    const again = await askSecret('Type the password again: ');
    if (again !== p) { say('The two passwords are not the same.'); mismatch = true; continue; }
    password = p;
  }
  if (!password) return { ok: false, reason: mismatch ? 'MISMATCH' : 'INVALID_PASSWORD' };

  // 4. create it, checking again inside one serializable transaction so two runs at once cannot both create one
  const hashed = await hash(password);
  password = '';
  try {
    const made = await prisma.$transaction(async (tx) => {
      if (await administratorExists(tx)) return 'EXISTS';
      await tx.vendor.create({ data: { name: 'Super Admin', email, password: hashed, businessName: 'Get4Domain', role: 'SUPER_ADMIN' } });
      return 'CREATED';
    }, { isolationLevel: 'Serializable' });
    if (made === 'EXISTS') { say('An administrator already exists. Nothing was created.'); return { ok: false, reason: 'EXISTS' }; }
  } catch (e) {
    if (e && e.code === 'P2002') { say('That email address is already used by another account. Nothing was created.'); return { ok: false, reason: 'EMAIL_TAKEN' }; }
    throw e;
  }
  say('The first SUPER_ADMIN was created. Sign in to the admin app with the email and password you typed.');
  return { ok: true };
}

module.exports = { bootstrapSuperAdmin, passwordProblem, administratorExists, MIN_LENGTH, MAX_LENGTH, EMAIL_RE };
