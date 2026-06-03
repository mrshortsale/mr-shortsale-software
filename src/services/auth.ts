import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';

const BASE_URL = `${SUPABASE_URL}/functions/v1`;
const ANON_KEY = SUPABASE_ANON_KEY;
const TOKEN_KEY = 'mrs_token';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'ceo' | 'rep';
  avatarColor: string;
}

export interface AuthResponse {
  success: boolean;
  user?: AuthUser;
  token?: string;
  error?: string;
  /** Set when signup succeeded but account is pending CEO approval (no token issued) */
  pendingApproval?: boolean;
  message?: string;
}

function baseHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${ANON_KEY}`,
    'apikey': ANON_KEY,
  };
}

function authedHeaders(): Record<string, string> {
  const token = getStoredToken();
  return {
    ...baseHeaders(),
    ...(token ? { 'x-auth-token': token } : {}),
  };
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function storeToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  try {
    const res = await fetch(`${BASE_URL}/auth-login`, {
      method: 'POST',
      headers: baseHeaders(),
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error ?? 'Login failed' };

    storeToken(data.token);
    return { success: true, user: data.user, token: data.token };
  } catch {
    return { success: false, error: 'Network error — please check your connection' };
  }
}

export async function signup(email: string, password: string, name: string): Promise<AuthResponse> {
  try {
    const res = await fetch(`${BASE_URL}/auth-signup`, {
      method: 'POST',
      headers: baseHeaders(),
      body: JSON.stringify({ email, password, name }),
    });

    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error ?? 'Sign-up failed' };

    // Signup now always returns pending — no token is issued
    return { success: true, pendingApproval: true, message: data.message, user: data.user };
  } catch {
    return { success: false, error: 'Network error — please check your connection' };
  }
}

export async function forgotPassword(email: string): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/auth-forgot-password`, {
      method: 'POST',
      headers: baseHeaders(),
      body: JSON.stringify({ email }),
    });

    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error ?? 'Request failed' };

    return { success: true, message: data.message };
  } catch {
    return { success: false, error: 'Network error — please check your connection' };
  }
}

export async function resetPassword(
  token: string,
  password: string,
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/auth-reset-password`, {
      method: 'POST',
      headers: baseHeaders(),
      body: JSON.stringify({ token, password }),
    });

    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error ?? 'Reset failed' };

    return { success: true, message: data.message };
  } catch {
    return { success: false, error: 'Network error — please check your connection' };
  }
}

export async function getMe(): Promise<AuthResponse> {
  const token = getStoredToken();
  if (!token) return { success: false, error: 'No token' };

  try {
    const res = await fetch(`${BASE_URL}/auth-me`, {
      method: 'GET',
      headers: {
        ...baseHeaders(),
        'x-auth-token': token,
      },
    });

    const data = await res.json();

    if (res.status === 401) {
      clearToken();
      return { success: false, error: data.error ?? 'Session expired' };
    }

    if (res.status === 403) {
      clearToken();
      // Pass through the server's specific message (pending, rejected, deactivated)
      return { success: false, error: data.error ?? 'Access denied' };
    }

    if (!res.ok) return { success: false, error: data.error ?? 'Session restore failed' };

    return { success: true, user: data.user };
  } catch {
    return { success: false, error: 'Network error' };
  }
}

// Admin operations (CEO only)
export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  role: 'ceo' | 'rep';
  avatar_color: string;
  is_active: boolean;
  status: 'pending' | 'active' | 'rejected';
  last_login_at: string | null;
  created_at: string;
}

export async function adminListUsers(): Promise<{ users?: AdminUserRow[]; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/admin-users`, {
      method: 'GET',
      headers: authedHeaders(),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Failed to fetch users' };
    return { users: data.users };
  } catch {
    return { error: 'Network error' };
  }
}

export async function adminListPendingUsers(): Promise<{ users?: AdminUserRow[]; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/admin-users?status=pending`, {
      method: 'GET',
      headers: authedHeaders(),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Failed to fetch pending users' };
    return { users: data.users };
  } catch {
    return { error: 'Network error' };
  }
}

export async function adminApproveUser(userId: string): Promise<{ user?: AdminUserRow; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/admin-users`, {
      method: 'POST',
      headers: authedHeaders(),
      body: JSON.stringify({ action: 'approve', userId }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Failed to approve user' };
    return { user: data.user };
  } catch {
    return { error: 'Network error' };
  }
}

export async function adminRejectUser(userId: string): Promise<{ user?: AdminUserRow; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/admin-users`, {
      method: 'POST',
      headers: authedHeaders(),
      body: JSON.stringify({ action: 'reject', userId }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Failed to reject user' };
    return { user: data.user };
  } catch {
    return { error: 'Network error' };
  }
}

export async function adminCreateUser(payload: {
  email: string; name: string; password: string; role: 'ceo' | 'rep';
  avatarColor: string; approveImmediately?: boolean;
}): Promise<{ user?: AdminUserRow; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/admin-users`, {
      method: 'POST',
      headers: authedHeaders(),
      body: JSON.stringify({ action: 'create', ...payload }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Failed to create user' };
    return { user: data.user };
  } catch {
    return { error: 'Network error' };
  }
}

export async function adminUpdateUser(
  userId: string,
  updates: { name?: string; role?: 'ceo' | 'rep'; avatarColor?: string; isActive?: boolean; password?: string }
): Promise<{ user?: AdminUserRow; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/admin-users`, {
      method: 'POST',
      headers: authedHeaders(),
      body: JSON.stringify({ action: 'update', userId, ...updates }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Failed to update user' };
    return { user: data.user };
  } catch {
    return { error: 'Network error' };
  }
}

export async function adminDeleteUser(userId: string): Promise<{ error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/admin-users`, {
      method: 'POST',
      headers: authedHeaders(),
      body: JSON.stringify({ action: 'delete', userId }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? 'Failed to delete user' };
    return {};
  } catch {
    return { error: 'Network error' };
  }
}
