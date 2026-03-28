/**
 * API client for Q-CRM Mobile
 * Adapted from the web app version — uses AsyncStorage instead of localStorage
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const API_URL = process.env.API_URL || 'http://20.124.178.41:3001';
const TOKEN_KEY = 'auth_token';

export async function getAuthToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setAuthToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function removeAuthToken(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {'Content-Type': 'application/json'};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// Callback invoked when a 401 is received (set by the auth store)
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

export async function apiClient<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const headers = {
    ...authHeaders,
    ...((options.headers as Record<string, string>) || {}),
  };

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    await removeAuthToken();
    if (onUnauthorized) {
      onUnauthorized();
    }
    throw new Error('Authentication required');
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({error: 'Request failed'}));
    throw new Error(errorData.error || `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// Convenience helpers
export const api = {
  get: <T = any>(path: string) => apiClient<T>(path),

  post: <T = any>(path: string, body: unknown) =>
    apiClient<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  put: <T = any>(path: string, body: unknown) =>
    apiClient<T>(path, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  patch: <T = any>(path: string, body: unknown) =>
    apiClient<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  delete: <T = any>(path: string) =>
    apiClient<T>(path, {method: 'DELETE'}),
};
