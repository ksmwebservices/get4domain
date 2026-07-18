// ============================================================
// GET4DOMAIN AUTH — Production-ready credential auth
// Credentials set via environment variables (no hardcoding)
// Google/Facebook OAuth: added via NextAuth.js (Task below)
// ============================================================

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'vendor' | 'admin' | 'super_admin';
  businessName?: string;
  plan?: string;
  initials: string;
}

// Session stored in localStorage (client-side)
// Phase 2: replace with httpOnly JWT cookie from NestJS backend
export function setSession(user: AuthUser): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('g4d_user', JSON.stringify(user));
}

export function getSession(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('g4d_user');
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('g4d_user');
}

export function isAuthenticated(): boolean {
  return getSession() !== null;
}

export function isAdmin(): boolean {
  const user = getSession();
  return user?.role === 'admin' || user?.role === 'super_admin';
}

// ── Production credentials from environment variables ──
// Set these in your .env.local file (never commit to git)
// NEXT_PUBLIC_ADMIN_EMAIL=admin@get4domain.com
// NEXT_PUBLIC_ADMIN_PASSWORD=YourStrongPassword123!
// NEXT_PUBLIC_ADMIN_NAME=Admin

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export function loginWithCredentials(
  email: string,
  password: string
): { success: boolean; user?: AuthUser; error?: string } {
  const inputEmail = email.toLowerCase().trim();

  // Check admin credentials from environment
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL?.toLowerCase().trim();
  const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;
  const adminName = process.env.NEXT_PUBLIC_ADMIN_NAME ?? 'Admin';

  if (adminEmail && inputEmail === adminEmail) {
    if (password !== adminPassword) {
      return { success: false, error: 'Incorrect password.' };
    }
    const user: AuthUser = {
      id: 'adm_001',
      name: adminName,
      email: inputEmail,
      role: 'super_admin',
      initials: getInitials(adminName),
    };
    setSession(user);
    return { success: true, user };
  }

  // Vendor credentials — in Phase 2 this calls the NestJS API
  // For now: vendors are created manually by admin and given credentials
  // Check against VENDOR_* env vars (support multiple vendors via numbered vars)
  // NEXT_PUBLIC_VENDOR_1_EMAIL, NEXT_PUBLIC_VENDOR_1_PASSWORD, etc.
  for (let i = 1; i <= 20; i++) {
    const vendorEmail = process.env[`NEXT_PUBLIC_VENDOR_${i}_EMAIL`]?.toLowerCase().trim();
    const vendorPassword = process.env[`NEXT_PUBLIC_VENDOR_${i}_PASSWORD`];
    const vendorName = process.env[`NEXT_PUBLIC_VENDOR_${i}_NAME`] ?? 'Vendor';
    const vendorBusiness = process.env[`NEXT_PUBLIC_VENDOR_${i}_BUSINESS`] ?? '';
    const vendorPlan = process.env[`NEXT_PUBLIC_VENDOR_${i}_PLAN`] ?? 'DomainApp Startup';

    if (!vendorEmail) break; // no more vendors configured

    if (inputEmail === vendorEmail) {
      if (password !== vendorPassword) {
        return { success: false, error: 'Incorrect password.' };
      }
      const user: AuthUser = {
        id: `usr_00${i}`,
        name: vendorName,
        email: inputEmail,
        role: 'vendor',
        businessName: vendorBusiness,
        plan: vendorPlan,
        initials: getInitials(vendorName),
      };
      setSession(user);
      return { success: true, user };
    }
  }

  return { success: false, error: 'No account found with this email. Contact support@get4domain.com' };
}
