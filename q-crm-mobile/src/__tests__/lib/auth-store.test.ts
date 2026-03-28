/**
 * Unit tests for the Zustand auth store (src/lib/auth-store.ts).
 * AsyncStorage is already mocked in jest.setup.js.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useAuthStore} from '../../lib/auth-store';
import {mockUser, mockAuthResponse, mockSalesUser} from '../setup/mock-data';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const initialState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  mustChangePassword: false,
};

let originalFetch: typeof global.fetch;

beforeAll(() => {
  originalFetch = global.fetch;
});

afterAll(() => {
  global.fetch = originalFetch;
});

beforeEach(async () => {
  // Reset Zustand store to initial state
  useAuthStore.setState(initialState);
  // Clear AsyncStorage
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

// ─── Initial state ────────────────────────────────────────────────────────────

describe('initial state', () => {
  it('has isAuthenticated=false', () => {
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('has user=null', () => {
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('has token=null', () => {
    expect(useAuthStore.getState().token).toBeNull();
  });

  it('has isLoading=false', () => {
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('has error=null', () => {
    expect(useAuthStore.getState().error).toBeNull();
  });
});

// ─── login() ─────────────────────────────────────────────────────────────────

describe('login()', () => {
  it('returns true and sets state on successful login', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockAuthResponse),
    });

    const result = await useAuthStore.getState().login('admin@qbalux.com', 'password123');

    expect(result).toBe(true);
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toEqual(mockAuthResponse.user);
    expect(state.token).toBe(mockAuthResponse.token);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('stores token in AsyncStorage on successful login', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockAuthResponse),
    });

    await useAuthStore.getState().login('admin@qbalux.com', 'password123');

    const storedToken = await AsyncStorage.getItem('auth_token');
    expect(storedToken).toBe(mockAuthResponse.token);
  });

  it('returns false and sets error on failed login', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: jest.fn().mockResolvedValue({error: 'Invalid credentials'}),
    });

    const result = await useAuthStore.getState().login('bad@email.com', 'wrong');

    expect(result).toBe(false);
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.error).toBe('Invalid credentials');
    expect(state.isLoading).toBe(false);
  });

  it('sets mustChangePassword when flag set in response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        ...mockAuthResponse,
        mustChangePassword: true,
      }),
    });

    await useAuthStore.getState().login('admin@qbalux.com', 'password123');

    expect(useAuthStore.getState().mustChangePassword).toBe(true);
  });

  it('sets generic error on network failure', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    const result = await useAuthStore.getState().login('admin@qbalux.com', 'password');

    expect(result).toBe(false);
    expect(useAuthStore.getState().error).toBe('Network error. Please try again.');
  });
});

// ─── logout() ────────────────────────────────────────────────────────────────

describe('logout()', () => {
  it('clears user, token, and isAuthenticated', async () => {
    // First log in
    useAuthStore.setState({
      user: mockUser,
      token: 'some-jwt',
      isAuthenticated: true,
    });
    await AsyncStorage.setItem('auth_token', 'some-jwt');

    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('removes token from AsyncStorage', async () => {
    await AsyncStorage.setItem('auth_token', 'some-jwt');
    useAuthStore.setState({token: 'some-jwt', isAuthenticated: true});

    await useAuthStore.getState().logout();

    expect(await AsyncStorage.getItem('auth_token')).toBeNull();
  });
});

// ─── checkAuth() ─────────────────────────────────────────────────────────────

describe('checkAuth()', () => {
  it('returns false when no token in store or AsyncStorage', async () => {
    const result = await useAuthStore.getState().checkAuth();
    expect(result).toBe(false);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('returns true and sets user when /api/auth/me succeeds', async () => {
    await AsyncStorage.setItem('auth_token', 'valid-token');
    useAuthStore.setState({token: 'valid-token'});

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockUser),
    });

    const result = await useAuthStore.getState().checkAuth();

    expect(result).toBe(true);
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toEqual(mockUser);
  });

  it('returns false and clears auth when /api/auth/me fails', async () => {
    await AsyncStorage.setItem('auth_token', 'expired-token');
    useAuthStore.setState({token: 'expired-token'});

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
    });

    const result = await useAuthStore.getState().checkAuth();

    expect(result).toBe(false);
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
  });
});

// ─── initialize() ────────────────────────────────────────────────────────────

describe('initialize()', () => {
  it('does nothing if no token in AsyncStorage', async () => {
    global.fetch = jest.fn();

    await useAuthStore.getState().initialize();

    expect(global.fetch).not.toHaveBeenCalled();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('calls checkAuth when token is found in AsyncStorage', async () => {
    await AsyncStorage.setItem('auth_token', 'stored-token');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockUser),
    });

    await useAuthStore.getState().initialize();

    expect(global.fetch).toHaveBeenCalled();
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });
});

// ─── hasPermission() ─────────────────────────────────────────────────────────

describe('hasPermission()', () => {
  it('returns false when no user', () => {
    expect(useAuthStore.getState().hasPermission('read_opportunities')).toBe(false);
  });

  it('returns true for admin user with wildcard permission', () => {
    useAuthStore.setState({user: mockUser}); // mockUser has role.permissions = ['*']
    expect(useAuthStore.getState().hasPermission('any_permission')).toBe(true);
  });

  it('returns true when user has the specific permission', () => {
    useAuthStore.setState({user: mockSalesUser});
    expect(useAuthStore.getState().hasPermission('read_opportunities')).toBe(true);
  });

  it('returns false when user lacks the specific permission', () => {
    useAuthStore.setState({user: mockSalesUser});
    expect(useAuthStore.getState().hasPermission('approve_gom')).toBe(false);
  });

  it('returns false for permission not in the list', () => {
    useAuthStore.setState({user: mockSalesUser});
    expect(useAuthStore.getState().hasPermission('delete_everything')).toBe(false);
  });
});

// ─── hasAnyPermission() ───────────────────────────────────────────────────────

describe('hasAnyPermission()', () => {
  it('returns false when no user', () => {
    expect(useAuthStore.getState().hasAnyPermission(['read_opportunities'])).toBe(false);
  });

  it('returns true if at least one permission matches', () => {
    useAuthStore.setState({user: mockSalesUser});
    expect(
      useAuthStore.getState().hasAnyPermission(['approve_gom', 'read_contacts']),
    ).toBe(true);
  });

  it('returns false if none of the permissions match', () => {
    useAuthStore.setState({user: mockSalesUser});
    expect(
      useAuthStore.getState().hasAnyPermission(['approve_gom', 'delete_everything']),
    ).toBe(false);
  });
});

// ─── clearError() ────────────────────────────────────────────────────────────

describe('clearError()', () => {
  it('sets error to null', () => {
    useAuthStore.setState({error: 'Some previous error'});
    useAuthStore.getState().clearError();
    expect(useAuthStore.getState().error).toBeNull();
  });
});
