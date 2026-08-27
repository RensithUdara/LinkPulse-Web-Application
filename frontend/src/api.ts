export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

export type User = {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
};

export type ShortURL = {
  id: string;
  user_id?: string;
  original_url: string;
  short_code: string;
  custom_alias?: string;
  click_count: number;
  created_at: string;
  updated_at: string;
  expires_at?: string | null;
};

export type CountRow = {
  label: string;
  count: number;
};

export type DailyCount = {
  date: string;
  count: number;
};

export type Analytics = {
  total_clicks: number;
  unique_visitors: number;
  clicks_by_day: DailyCount[] | null;
  countries: CountRow[] | null;
  devices: CountRow[] | null;
  browsers: CountRow[] | null;
  operating_systems: CountRow[] | null;
  referrers: CountRow[] | null;
};

type AuthResponse = {
  user: User;
  token: string;
};

type CreateURLResponse = {
  id: string;
  original_url: string;
  short_code: string;
  short_url: string;
  expires_at?: string | null;
};

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(body.error ?? 'Request failed');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function shortURLFor(code: string) {
  return `${API_BASE_URL}/${code}`;
}

export const api = {
  register(email: string, password: string) {
    return request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },
  login(email: string, password: string) {
    return request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },
  listURLs(token: string) {
    return request<ShortURL[]>('/api/urls', {}, token);
  },
  createURL(token: string, payload: { original_url: string; custom_alias?: string; expires_at?: string }) {
    return request<CreateURLResponse>(
      '/api/urls',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token,
    );
  },
  deleteURL(token: string, id: string) {
    return request<void>(`/api/urls/${id}`, { method: 'DELETE' }, token);
  },
  analytics(token: string, id: string) {
    return request<Analytics>(`/api/urls/${id}/analytics`, {}, token);
  },
};
