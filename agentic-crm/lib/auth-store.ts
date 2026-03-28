import { create } from 'zustand';
import { API_URL } from './api';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  title?: string;
  department?: string;
  image?: string;
  role: {
    id: string;
    name: string;
    permissions: string[];
  };
  roles: {
    id: string;
    name: string;
    permissions: string[];
  }[];
  team?: {
    id: string;
    name: string;
  } | null;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  mustChangePassword: boolean;

  login: (email: string, password: string) => Promise<boolean>;
  ssoLogin: (email: string) => Promise<boolean>;
  ssoCallback: (code: string) => Promise<boolean>;
  logout: () => void;
  checkAuth: () => Promise<boolean>;
  switchRole: (roleId: string) => Promise<boolean>;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  mustChangePassword: false,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        set({ isLoading: false, error: data.error || 'Login failed' });
        return false;
      }

      const data = await res.json();
      localStorage.setItem('auth_token', data.token);
      set({
        user: data.user,
        token: data.token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        mustChangePassword: !!data.mustChangePassword,
      });
      return true;
    } catch (error) {
      set({ isLoading: false, error: 'Network error. Please try again.' });
      return false;
    }
  },

  ssoLogin: async (email: string) => {
    set({ isLoading: true, error: null });
    try {
      // Step 1: Get Microsoft OAuth URL from backend
      const res = await fetch(`${API_URL}/api/auth/sso/url`);
      if (!res.ok) {
        const data = await res.json();
        set({ isLoading: false, error: data.error || 'SSO not configured' });
        return false;
      }
      const { url } = await res.json();
      // Store email hint for after redirect
      localStorage.setItem('sso_email_hint', email);
      // Redirect to Microsoft login 
      window.location.href = url;
      return true; // won't actually reach here due to redirect
    } catch (error) {
      set({ isLoading: false, error: 'Network error. Please try again.' });
      return false;
    }
  },

  // Called after Microsoft redirects back with auth code
  ssoCallback: async (code: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_URL}/api/auth/sso/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      if (!res.ok) {
        const data = await res.json();
        set({ isLoading: false, error: data.error || 'SSO authentication failed' });
        return false;
      }

      const data = await res.json();
      localStorage.setItem('auth_token', data.token);
      set({
        user: data.user,
        token: data.token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        mustChangePassword: false,
      });
      return true;
    } catch (error) {
      set({ isLoading: false, error: 'Network error. Please try again.' });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem('auth_token');
    set({ user: null, token: null, isAuthenticated: false, error: null });
  },

  checkAuth: async () => {
    const token = get().token || localStorage.getItem('auth_token');
    if (!token) {
      set({ isAuthenticated: false, user: null });
      return false;
    }

    try {
      const res = await fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        localStorage.removeItem('auth_token');
        set({ isAuthenticated: false, user: null, token: null });
        return false;
      }

      const user = await res.json();
      set({ user, token, isAuthenticated: true });
      return true;
    } catch {
      set({ isAuthenticated: false, user: null });
      return false;
    }
  },

  switchRole: async (roleId: string) => {
    const token = get().token;
    if (!token) return false;

    try {
      const res = await fetch(`${API_URL}/api/auth/switch-role`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ roleId }),
      });

      if (!res.ok) return false;

      const data = await res.json();
      localStorage.setItem('auth_token', data.token);
      set({
        user: data.user,
        token: data.token,
        isAuthenticated: true,
      });
      return true;
    } catch {
      return false;
    }
  },

  hasPermission: (permission: string) => {
    const user = get().user;
    if (!user) return false;
    const perms = user.role.permissions;
    if (perms.includes('*')) return true;
    return perms.includes(permission);
  },

  hasAnyPermission: (permissions: string[]) => {
    const user = get().user;
    if (!user) return false;
    const perms = user.role.permissions;
    if (perms.includes('*')) return true;
    return permissions.some((p) => perms.includes(p));
  },

  clearError: () => set({ error: null }),
}));
