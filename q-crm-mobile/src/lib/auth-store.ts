/**
 * Auth store for Q-CRM Mobile
 * Adapted from web app — uses AsyncStorage for token persistence
 */
import {create} from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {API_URL, setAuthToken, removeAuthToken} from './api';

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
  logout: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
  switchRole: (roleId: string) => Promise<boolean>;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  clearError: () => void;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  mustChangePassword: false,

  /** Load token from AsyncStorage on app start */
  initialize: async () => {
    const token = await AsyncStorage.getItem('auth_token');
    if (token) {
      set({token});
      await get().checkAuth();
    }
  },

  login: async (email: string, password: string) => {
    set({isLoading: true, error: null});
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email, password}),
      });

      if (!res.ok) {
        const data = await res.json();
        set({isLoading: false, error: data.error || 'Login failed'});
        return false;
      }

      const data = await res.json();
      await setAuthToken(data.token);
      set({
        user: data.user,
        token: data.token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        mustChangePassword: !!data.mustChangePassword,
      });
      return true;
    } catch {
      set({isLoading: false, error: 'Network error. Please try again.'});
      return false;
    }
  },

  logout: async () => {
    await removeAuthToken();
    set({user: null, token: null, isAuthenticated: false, error: null});
  },

  checkAuth: async () => {
    const token = get().token || (await AsyncStorage.getItem('auth_token'));
    if (!token) {
      set({isAuthenticated: false, user: null});
      return false;
    }

    try {
      const res = await fetch(`${API_URL}/api/auth/me`, {
        headers: {Authorization: `Bearer ${token}`},
      });

      if (!res.ok) {
        await removeAuthToken();
        set({isAuthenticated: false, user: null, token: null});
        return false;
      }

      const user = await res.json();
      set({user, token, isAuthenticated: true});
      return true;
    } catch {
      set({isAuthenticated: false, user: null});
      return false;
    }
  },

  switchRole: async (roleId: string) => {
    const token = get().token;
    if (!token) {
      return false;
    }

    try {
      const res = await fetch(`${API_URL}/api/auth/switch-role`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({roleId}),
      });

      if (!res.ok) {
        return false;
      }

      const data = await res.json();
      await setAuthToken(data.token);
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
    if (!user) {
      return false;
    }
    const perms = user.role.permissions;
    if (perms.includes('*')) {
      return true;
    }
    return perms.includes(permission);
  },

  hasAnyPermission: (permissions: string[]) => {
    const user = get().user;
    if (!user) {
      return false;
    }
    const perms = user.role.permissions;
    if (perms.includes('*')) {
      return true;
    }
    return permissions.some(p => perms.includes(p));
  },

  clearError: () => set({error: null}),
}));
