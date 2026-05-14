const BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
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

    storeToken(data.token);
    return { success: true, user: data.user, token: data.token };
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

    if (res.status === 401 || res.status === 403) {
      clearToken();
      return { success: false, error: 'Session expired' };
    }

    const data = await res.json();
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

export async function adminCreateUser(payload: {
  email: string; name: string; password: string; role: 'ceo' | 'rep'; avatarColor: string;
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
