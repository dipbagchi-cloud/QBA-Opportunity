import {useAuthStore} from '../lib/auth-store';

/**
 * Convenience wrapper around the Zustand auth store.
 * Prefer this hook in screens/components over importing
 * useAuthStore directly.
 */
export function useAuth() {
  const user = useAuthStore(s => s.user);
  const role = useAuthStore(s => s.role);
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const isLoading = useAuthStore(s => s.isLoading);
  const error = useAuthStore(s => s.error);
  const login = useAuthStore(s => s.login);
  const logout = useAuthStore(s => s.logout);
  const checkAuth = useAuthStore(s => s.checkAuth);
  const switchRole = useAuthStore(s => s.switchRole);
  const hasPermission = useAuthStore(s => s.hasPermission);
  const hasAnyPermission = useAuthStore(s => s.hasAnyPermission);
  const clearError = useAuthStore(s => s.clearError);

  return {
    user,
    role,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    checkAuth,
    switchRole,
    hasPermission,
    hasAnyPermission,
    clearError,
  };
}
