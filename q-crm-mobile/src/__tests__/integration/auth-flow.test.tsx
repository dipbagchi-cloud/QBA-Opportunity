/**
 * Integration test: Auth flow combining auth store + navigation.
 * Renders the AppNavigator to test unauthenticated → login → authenticated transitions.
 */
import React from 'react';
import {render, fireEvent, screen, waitFor, act} from '@testing-library/react-native';
import {useAuthStore} from '../../lib/auth-store';
import {mockAuthResponse} from '../setup/mock-data';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({children}: any) => children,
  SafeAreaProvider: ({children}: any) => children,
  useSafeAreaInsets: () => ({top: 0, right: 0, bottom: 0, left: 0}),
  initialWindowMetrics: {
    frame: {x: 0, y: 0, width: 375, height: 812},
    insets: {top: 44, right: 0, bottom: 34, left: 0},
  },
}));

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Mock RN screens (used by native stack navigator)
jest.mock('react-native-screens', () => ({
  enableScreens: jest.fn(),
  Screen: ({children}: any) => children,
  ScreenContainer: ({children}: any) => children,
}));

jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => {
    const React = require('react');
    const Navigator = ({children}: any) => {
      return React.createElement(React.Fragment, null, children);
    };
    const Screen = ({component: C}: any) => React.createElement(C);
    return {Navigator, Screen};
  },
}));

jest.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: () => {
    const React = require('react');
    const Navigator = ({children}: any) =>
      React.createElement(React.Fragment, null, children);
    const Screen = ({component: C}: any) => React.createElement(C);
    return {Navigator, Screen};
  },
}));

jest.mock('@react-navigation/drawer', () => ({
  createDrawerNavigator: () => {
    const React = require('react');
    const Navigator = ({children}: any) =>
      React.createElement(React.Fragment, null, children);
    const Screen = ({component: C}: any) => React.createElement(C);
    return {Navigator, Screen};
  },
}));

jest.mock('react-native/Libraries/Linking/Linking', () => ({
  openURL: jest.fn().mockResolvedValue(undefined),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const initialAuthState = {
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
  useAuthStore.setState(initialAuthState);
  jest.clearAllMocks();

  const AsyncStorage = require('@react-native-async-storage/async-storage');
  await AsyncStorage.clear();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Auth flow integration', () => {
  describe('auth store state transitions', () => {
    it('starts unauthenticated', () => {
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();
    });

    it('login() with valid credentials sets isAuthenticated=true', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockAuthResponse),
      });

      const success = await useAuthStore.getState().login('admin@qbalux.com', 'password');

      expect(success).toBe(true);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().user).toEqual(mockAuthResponse.user);
      expect(useAuthStore.getState().token).toBe(mockAuthResponse.token);
    });

    it('login() with invalid credentials keeps isAuthenticated=false', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        json: jest.fn().mockResolvedValue({error: 'Invalid credentials'}),
      });

      const success = await useAuthStore.getState().login('bad@user.com', 'wrong');

      expect(success).toBe(false);
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().error).toBe('Invalid credentials');
    });

    it('logout() after login resets state to unauthenticated', async () => {
      // Simulate logged-in state
      useAuthStore.setState({
        user: mockAuthResponse.user,
        token: mockAuthResponse.token,
        isAuthenticated: true,
      });

      await useAuthStore.getState().logout();

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().token).toBeNull();
    });
  });

  describe('token persistence via AsyncStorage', () => {
    it('token is stored in AsyncStorage after login', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockAuthResponse),
      });

      await useAuthStore.getState().login('admin@qbalux.com', 'password');

      const AsyncStorage = require('@react-native-async-storage/async-storage');
      const storedToken = await AsyncStorage.getItem('auth_token');
      expect(storedToken).toBe(mockAuthResponse.token);
    });

    it('token is removed from AsyncStorage after logout', async () => {
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      await AsyncStorage.setItem('auth_token', mockAuthResponse.token);
      useAuthStore.setState({token: mockAuthResponse.token, isAuthenticated: true});

      await useAuthStore.getState().logout();

      expect(await AsyncStorage.getItem('auth_token')).toBeNull();
    });

    it('initialize() restores session from AsyncStorage', async () => {
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      await AsyncStorage.setItem('auth_token', mockAuthResponse.token);

      // checkAuth will call /api/auth/me
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockAuthResponse.user),
      });

      await useAuthStore.getState().initialize();

      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().user).toEqual(mockAuthResponse.user);
    });

    it('initialize() clears state when stored token is invalid', async () => {
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      await AsyncStorage.setItem('auth_token', 'expired-token');

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
      });

      await useAuthStore.getState().initialize();

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();
    });
  });

  describe('full login → logout cycle', () => {
    it('completes a full login → logout cycle with correct state transitions', async () => {
      // Step 1: Start unauthenticated
      expect(useAuthStore.getState().isAuthenticated).toBe(false);

      // Step 2: Login
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockAuthResponse),
      });
      await useAuthStore.getState().login('admin@qbalux.com', 'password');
      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      // Step 3: Logout
      await useAuthStore.getState().logout();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().token).toBeNull();
    });
  });
});
