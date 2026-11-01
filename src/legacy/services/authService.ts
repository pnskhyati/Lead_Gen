/**
 * Client auth against /api/app/* (httpOnly session cookie).
 */
const API_BASE = import.meta.env.VITE_API_URL || '';

export interface AppUser {
  id: string;
  email: string;
  name?: string;
  role?: string;
}

async function parseJson(res: Response) {
  return res.json().catch(() => ({}));
}

export async function getAppAuthStatus(): Promise<{
  hasUsers: boolean;
  allowRegister: boolean;
  demoLogin: boolean;
  demoEmail: string | null;
}> {
  const res = await fetch(`${API_BASE}/api/app/status`, { credentials: 'include' });
  const json = await parseJson(res);
  return {
    hasUsers: Boolean(json.data?.hasUsers),
    allowRegister: Boolean(json.data?.allowRegister),
    demoLogin: Boolean(json.data?.demoLogin),
    demoEmail: json.data?.demoEmail || null,
  };
}

export async function getCurrentUser(): Promise<AppUser | null> {
  try {
    const res = await fetch(`${API_BASE}/api/app/me`, { credentials: 'include' });
    if (!res.ok) return null;
    const json = await parseJson(res);
    return json.data?.user || null;
  } catch {
    return null;
  }
}

export async function login(email: string, password: string): Promise<AppUser> {
  const res = await fetch(`${API_BASE}/api/app/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });
  const json = await parseJson(res);
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Sign in failed');
  }
  return json.data.user as AppUser;
}

export async function register(email: string, password: string, name?: string): Promise<AppUser> {
  const res = await fetch(`${API_BASE}/api/app/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password, name }),
  });
  const json = await parseJson(res);
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Registration failed');
  }
  return json.data.user as AppUser;
}

export async function demoLogin(): Promise<AppUser> {
  const res = await fetch(`${API_BASE}/api/app/demo-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  const json = await parseJson(res);
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Demo login failed');
  }
  return json.data.user as AppUser;
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE}/api/app/logout`, {
    method: 'POST',
    credentials: 'include',
  }).catch(() => {});
}
