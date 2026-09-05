// ============================================================
// GET4DOMAIN AUTH — backed by the real NestJS API
// ============================================================

export type AdminRole = 'SUPER_ADMIN' | 'MARKETING' | 'OPERATIONS';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'vendor' | 'admin' | 'super_admin';
  /** Internal Get4Domain staff role — present for admin/super_admin users. */
  adminRole?: AdminRole;
  businessName?: string;
  industry?: string;
  subdomain?: string;
  plan?: string;
  initials: string;
  /** Present for a vendor's team member: 'team_member'. Restricts which modules they see. */
  kind?: string;
  /** Canonical access areas granted to a team member (see backend team-access.ts). */
  modules?: string[];
}

// Session stored in localStorage (client-side)
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
  localStorage.removeItem('g4d_token');
}

export function isAuthenticated(): boolean {
  return getSession() !== null;
}

export function isAdmin(): boolean {
  const user = getSession();
  return user?.role === 'admin' || user?.role === 'super_admin';
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function mapRole(backendRole: string): AuthUser['role'] {
  if (backendRole === 'SUPER_ADMIN') return 'super_admin';
  if (backendRole === 'ADMIN') return 'admin';
  return 'vendor';
}

export async function loginWithCredentials(
  email: string,
  password: string
): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
  try {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://gapi.get4domain.com';
    const response = await fetch(`${apiBase}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const body = await response.json();

    if (!response.ok) {
      return { success: false, error: body.message || 'Invalid credentials' };
    }

    // Backend wraps responses as { success, statusCode, message, data, timestamp }
    // and /auth/login's data payload is { accessToken, user }.
    const { accessToken, user: backendUser } = body.data;

    if (typeof window !== 'undefined') {
      localStorage.setItem('g4d_token', accessToken);
    }

    const user: AuthUser = {
      id: backendUser.id,
      name: backendUser.name,
      email: backendUser.email,
      role: mapRole(backendUser.role),
      adminRole: backendUser.adminRole ?? undefined,
      businessName: backendUser.businessName,
      industry: backendUser.industry ?? undefined,
      subdomain: backendUser.subdomain ?? undefined,
      plan: 'DomainApp Startup',
      initials: getInitials(backendUser.name),
      kind: backendUser.kind ?? undefined,
      modules: Array.isArray(backendUser.modules) ? backendUser.modules : undefined,
    };

    setSession(user);
    return { success: true, user };
  } catch {
    return { success: false, error: 'Connection error. Please try again.' };
  }
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  businessName: string;
  industry: string;
  phone?: string;
}

/** Self-service signup → creates the vendor and logs in (same session handling as login). */
export async function registerWithCredentials(
  input: RegisterInput,
): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
  try {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://gapi.get4domain.com';
    const response = await fetch(`${apiBase}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    const body = await response.json();
    if (!response.ok) {
      // Backend sends a string message or a class-validator array — surface the first line.
      const msg = Array.isArray(body?.message) ? body.message[0] : body?.message;
      return { success: false, error: msg || 'Could not create your account' };
    }

    const { accessToken, user: backendUser } = body.data;
    if (typeof window !== 'undefined') {
      localStorage.setItem('g4d_token', accessToken);
    }

    const user: AuthUser = {
      id: backendUser.id,
      name: backendUser.name,
      email: backendUser.email,
      role: mapRole(backendUser.role),
      businessName: backendUser.businessName,
      industry: backendUser.industry ?? undefined,
      subdomain: backendUser.subdomain ?? undefined,
      plan: 'DomainApp Startup',
      initials: getInitials(backendUser.name),
    };

    setSession(user);
    return { success: true, user };
  } catch {
    return { success: false, error: 'Connection error. Please try again.' };
  }
}
