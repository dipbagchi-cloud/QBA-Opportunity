/**
 * Screen tests for LoginScreen (src/screens/auth/LoginScreen.tsx).
 * Navigation is mocked in jest.setup.js.
 * Auth store is mocked per test.
 */
import React from 'react';
import {ActivityIndicator} from 'react-native';
import {render, fireEvent, screen, waitFor} from '@testing-library/react-native';

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

jest.mock('react-native/Libraries/Linking/Linking', () => ({
  openURL: jest.fn().mockResolvedValue(undefined),
}));

const mockLogin = jest.fn();
const mockClearError = jest.fn();

jest.mock('../../lib/auth-store', () => ({
  useAuthStore: jest.fn(),
}));

import {LoginScreen} from '../../screens/auth/LoginScreen';
import {useAuthStore} from '../../lib/auth-store';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockNavigation: any = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  push: jest.fn(),
};

function renderLoginScreen() {
  return render(
    <LoginScreen
      navigation={mockNavigation}
      route={{key: 'login', name: 'Login'} as any}
    />,
  );
}

/** Press the Sign In submit button (last element with "Sign In" text = the Button). */
function pressSignInButton() {
  const all = screen.getAllByText('Sign In');
  fireEvent.press(all[all.length - 1]);
}

function setAuthStoreMock(overrides: {
  login?: jest.Mock;
  isLoading?: boolean;
  error?: string | null;
  clearError?: jest.Mock;
} = {}) {
  (useAuthStore as jest.Mock).mockReturnValue({
    login: mockLogin,
    isLoading: false,
    error: null,
    clearError: mockClearError,
    ...overrides,
  });
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  setAuthStoreMock();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('LoginScreen', () => {
  describe('rendering', () => {
    it('renders at least one "Sign In" element (title + button)', () => {
      renderLoginScreen();
      expect(screen.getAllByText('Sign In').length).toBeGreaterThanOrEqual(2);
    });

    it('renders the Q-CRM brand name', () => {
      renderLoginScreen();
      // The brand name "Q‑CRM" appears in both the header and footer (multiple matches)
      expect(screen.getAllByText(/Q.CRM/i).length).toBeGreaterThanOrEqual(1);
    });

    it('renders email input', () => {
      renderLoginScreen();
      expect(screen.getByPlaceholderText('you@company.com')).toBeTruthy();
    });

    it('renders password input', () => {
      renderLoginScreen();
      expect(screen.getByPlaceholderText('Enter your password')).toBeTruthy();
    });

    it('renders the Microsoft SSO button', () => {
      renderLoginScreen();
      expect(screen.getByText(/Microsoft SSO/i)).toBeTruthy();
    });

    it('renders the tagline', () => {
      renderLoginScreen();
      expect(screen.getByText(/Sales Intelligence Platform/i)).toBeTruthy();
    });
  });

  describe('form validation', () => {
    it('shows "Email is required" error when email is blank on submit', async () => {
      renderLoginScreen();
      pressSignInButton();

      await waitFor(() => {
        expect(screen.getByText('Email is required')).toBeTruthy();
      });
    });

    it('shows "Enter a valid email address" for invalid email format', async () => {
      renderLoginScreen();
      fireEvent.changeText(
        screen.getByPlaceholderText('you@company.com'),
        'not-an-email',
      );
      pressSignInButton();

      await waitFor(() => {
        expect(screen.getByText('Enter a valid email address')).toBeTruthy();
      });
    });

    it('shows "Password is required" error when password is blank', async () => {
      renderLoginScreen();
      fireEvent.changeText(
        screen.getByPlaceholderText('you@company.com'),
        'user@example.com',
      );
      pressSignInButton();

      await waitFor(() => {
        expect(screen.getByText('Password is required')).toBeTruthy();
      });
    });
  });

  describe('submission', () => {
    it('calls auth store login with email and password on valid submit', async () => {
      mockLogin.mockResolvedValue(true);
      renderLoginScreen();

      fireEvent.changeText(
        screen.getByPlaceholderText('you@company.com'),
        'admin@qbalux.com',
      );
      fireEvent.changeText(
        screen.getByPlaceholderText('Enter your password'),
        'password123',
      );
      pressSignInButton();

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('admin@qbalux.com', 'password123');
      });
    });

    it('lowercases email before submitting', async () => {
      mockLogin.mockResolvedValue(true);
      renderLoginScreen();

      // Uppercase email passes pattern validation; onSubmit lowercases it
      fireEvent.changeText(
        screen.getByPlaceholderText('you@company.com'),
        'ADMIN@QBALUX.COM',
      );
      fireEvent.changeText(
        screen.getByPlaceholderText('Enter your password'),
        'password123',
      );
      pressSignInButton();

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('admin@qbalux.com', 'password123');
      });
    });

    it('login is called when valid credentials are submitted', async () => {
      mockLogin.mockResolvedValue(false);
      setAuthStoreMock({error: 'Invalid credentials'});

      renderLoginScreen();
      fireEvent.changeText(
        screen.getByPlaceholderText('you@company.com'),
        'bad@user.com',
      );
      fireEvent.changeText(
        screen.getByPlaceholderText('Enter your password'),
        'wrongpass',
      );
      pressSignInButton();

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalled();
      });
    });

    it('shows ActivityIndicator when isLoading=true', () => {
      setAuthStoreMock({isLoading: true});

      const {UNSAFE_getAllByType} = renderLoginScreen();
      // Loading=true makes Button show ActivityIndicator instead of text
      expect(UNSAFE_getAllByType(ActivityIndicator).length).toBeGreaterThanOrEqual(1);
    });
  });
});
