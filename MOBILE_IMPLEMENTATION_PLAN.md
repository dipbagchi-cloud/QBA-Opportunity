# Q-CRM Mobile App — Full Developer Implementation Plan

**Project**: React Native (Bare) mobile app — pixel-accurate equivalent of Q-CRM Next.js web app  
**Root path**: `d:\Opportunity\Jaydeep_work\q-crm-mobile\`  
**Backend API**: `http://20.124.178.41:3001`  
**Author**: Agent 2 — Developer-Ready Phased Plan  
**Date**: March 28, 2026  

---

## Table of Contents

1. [Phase 0: Project Scaffolding (Week 1)](#phase-0-project-scaffolding)
2. [Phase 1: Shared Logic Layer (Week 2)](#phase-1-shared-logic-layer)
3. [Phase 2: Design System + Base Components (Weeks 3–4)](#phase-2-design-system)
4. [Phase 3: Navigation Architecture (Week 4)](#phase-3-navigation-architecture)
5. [Phase 4: Screen Implementation (Weeks 5–12)](#phase-4-screen-implementation)
6. [Phase 5: Advanced Features (Weeks 13–15)](#phase-5-advanced-features)
7. [Phase 6: Testing & QA (Weeks 16–17)](#phase-6-testing--qa)
8. [Phase 7: Build & Deploy (Weeks 18–20)](#phase-7-build--deploy)

---

## Phase 0: Project Scaffolding

### 0.1 Prerequisites

Ensure these are installed on the Windows dev machine:

```powershell
# Verify Node.js >= 18
node --version

# Verify Java 17 (for Android)
java --version

# Verify Android Studio is installed and ANDROID_HOME is set
$env:ANDROID_HOME

# Install React Native CLI globally
npm install -g react-native@0.75.0

# Install EAS CLI for later builds
npm install -g eas-cli@10.0.0
```

### 0.2 Initialize the Bare React Native Project

```powershell
Set-Location d:\Opportunity\Jaydeep_work

# Initialize project
npx react-native@0.75.0 init QCrmMobile --template react-native-template-typescript --directory q-crm-mobile

Set-Location q-crm-mobile
```

### 0.3 Full Directory Structure

After scaffolding, create this exact folder tree:

```powershell
# Create all required directories
$dirs = @(
  "src\screens\auth",
  "src\screens\dashboard",
  "src\screens\opportunities",
  "src\screens\contacts",
  "src\screens\analytics",
  "src\screens\gom",
  "src\screens\agents",
  "src\screens\settings",
  "src\components\common",
  "src\components\charts",
  "src\components\forms",
  "src\components\opportunities",
  "src\navigation",
  "src\lib",
  "src\theme",
  "src\hooks",
  "src\types",
  "src\store",
  "src\services",
  "src\utils",
  "assets\images",
  "assets\fonts",
  "android\app\src\main\res",
  "__tests__\screens",
  "__tests__\components",
  "__tests__\hooks"
)
foreach ($d in $dirs) { New-Item -ItemType Directory -Force -Path $d }
```

Final directory tree:

```
q-crm-mobile/
├── android/
├── ios/
├── src/
│   ├── screens/
│   │   ├── auth/
│   │   │   └── LoginScreen.tsx
│   │   ├── dashboard/
│   │   │   └── DashboardScreen.tsx
│   │   ├── opportunities/
│   │   │   ├── OpportunitiesScreen.tsx
│   │   │   ├── OpportunityDetailScreen.tsx
│   │   │   ├── NewOpportunityScreen.tsx
│   │   │   └── KanbanScreen.tsx
│   │   ├── contacts/
│   │   │   └── ContactsScreen.tsx
│   │   ├── analytics/
│   │   │   └── AnalyticsScreen.tsx
│   │   ├── gom/
│   │   │   └── GomScreen.tsx
│   │   ├── agents/
│   │   │   └── AgentsScreen.tsx
│   │   └── settings/
│   │       └── SettingsScreen.tsx
│   ├── components/
│   │   ├── common/
│   │   │   ├── Button.tsx
│   │   │   ├── TextInput.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── BottomSheet.tsx
│   │   │   ├── Tabs.tsx
│   │   │   ├── Spinner.tsx
│   │   │   ├── Avatar.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Switch.tsx
│   │   │   ├── Divider.tsx
│   │   │   ├── Toast.tsx
│   │   │   ├── IconButton.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   └── SkeletonLoader.tsx
│   │   ├── charts/
│   │   │   ├── RevenueChart.tsx
│   │   │   └── FunnelChart.tsx
│   │   ├── forms/
│   │   │   └── FormField.tsx
│   │   └── opportunities/
│   │       ├── OpportunityCard.tsx
│   │       └── KanbanColumn.tsx
│   ├── navigation/
│   │   ├── AppNavigator.tsx
│   │   ├── AuthNavigator.tsx
│   │   ├── MainTabNavigator.tsx
│   │   ├── OpportunitiesStack.tsx
│   │   └── linking.ts
│   ├── lib/
│   │   ├── api.ts
│   │   ├── auth-store.ts
│   │   ├── gom-calculator.ts
│   │   ├── rate-cards.ts
│   │   └── utils.ts
│   ├── theme/
│   │   ├── colors.ts
│   │   ├── typography.ts
│   │   ├── spacing.ts
│   │   └── theme.ts
│   ├── hooks/
│   │   ├── useToast.ts
│   │   ├── useRefreshControl.ts
│   │   └── useDebounce.ts
│   ├── types/
│   │   └── index.ts
│   ├── store/
│   │   └── opportunity-store.ts
│   └── services/
│       └── push-notifications.ts
├── assets/
│   ├── images/
│   └── fonts/
├── __tests__/
├── App.tsx
├── babel.config.js
├── tsconfig.json
├── .env
├── .env.production
├── jest.config.js
├── .eslintrc.js
└── .prettierrc
```

### 0.4 Core Dependencies (Exact Versions)

```powershell
# Navigation
npm install @react-navigation/native@6.1.18 @react-navigation/stack@6.4.1 @react-navigation/bottom-tabs@6.6.1 @react-navigation/drawer@6.7.2

# Navigation peer deps
npm install react-native-screens@3.34.0 react-native-safe-area-context@4.13.1 react-native-gesture-handler@2.20.2 react-native-reanimated@3.16.1

# State management
npm install zustand@4.5.5 @tanstack/react-query@5.59.0

# Storage (replaces localStorage)
npm install @react-native-async-storage/async-storage@1.24.0

# UI Component Library
npm install react-native-paper@5.12.5 react-native-vector-icons@10.2.0

# Bottom Sheet
npm install @gorhom/bottom-sheet@4.6.4

# Charts
npm install react-native-gifted-charts@1.4.4 victory-native@41.1.0

# Forms
npm install react-hook-form@7.53.2 @hookform/resolvers@3.9.1 zod@3.23.8

# Date picker
npm install react-native-date-picker@4.4.2

# Notifications
npm install @notifee/react-native@9.1.6

# Offline / SQLite
npm install react-native-sqlite-storage@6.0.1

# Biometric auth
npm install react-native-biometrics@3.0.1

# File picker
npm install react-native-document-picker@9.3.1 react-native-image-picker@7.1.2

# WebSocket / live terminal streaming
npm install react-native-url-polyfill@2.0.0

# Environment variables
npm install react-native-config@1.5.3

# Dev dependencies
npm install --save-dev @types/react-native-vector-icons@6.4.18 detox@20.27.1 jest@29.7.0 @testing-library/react-native@12.7.2 eslint@9.12.0 prettier@3.3.3
```

### 0.5 TypeScript Configuration

**`tsconfig.json`**:
```json
{
  "extends": "@tsconfig/react-native/tsconfig.json",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@theme/*": ["src/theme/*"],
      "@screens/*": ["src/screens/*"],
      "@components/*": ["src/components/*"],
      "@hooks/*": ["src/hooks/*"],
      "@lib/*": ["src/lib/*"],
      "@store/*": ["src/store/*"],
      "@types/*": ["src/types/*"]
    }
  }
}
```

**`babel.config.js`**:
```js
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    'react-native-reanimated/plugin',
    ['module-resolver', {
      root: ['./src'],
      alias: {
        '@': './src',
        '@theme': './src/theme',
        '@screens': './src/screens',
        '@components': './src/components',
        '@hooks': './src/hooks',
        '@lib': './src/lib',
        '@store': './src/store',
      },
    }],
    ['module:react-native-dotenv', {
      moduleName: '@env',
      path: '.env',
    }],
  ],
};
```

### 0.6 Environment Files

**`.env`** (development):
```
API_URL=http://20.124.178.41:3001
APP_ENV=development
```

**`.env.production`**:
```
API_URL=https://your-production-api.com
APP_ENV=production
```

---

## Phase 1: Shared Logic Layer

### 1.1 API Client (React Native Adaptation)

`src/lib/api.ts` — replaces `localStorage` with `AsyncStorage`, removes window/DOM references:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@env';

export { API_URL };

export async function getAuthToken(): Promise<string | null> {
  return AsyncStorage.getItem('auth_token');
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// Navigation ref for programmatic navigation outside components
import { createNavigationContainerRef } from '@react-navigation/native';
import { RootStackParamList } from '@/types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export async function apiClient<T = any>(
  path: string,
  options: RequestInit = {}
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
    await AsyncStorage.removeItem('auth_token');
    // Navigate to login — works outside React tree via ref
    if (navigationRef.isReady()) {
      navigationRef.reset({ index: 0, routes: [{ name: 'Login' }] });
    }
    throw new Error('Authentication required');
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(errorData.error || `HTTP ${res.status}`);
  }

  return res.json();
}
```

### 1.2 Auth Store (React Native Adaptation)

`src/lib/auth-store.ts` — replaces `localStorage` with `AsyncStorage`:

```typescript
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@env';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  title?: string;
  department?: string;
  image?: string;
  role: { id: string; name: string; permissions: string[] };
  roles: { id: string; name: string; permissions: string[] }[];
  team?: { id: string; name: string } | null;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  mustChangePassword: boolean;
  hydrated: boolean;

  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<boolean>;
  ssoLogin: (email: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  mustChangePassword: false,
  hydrated: false,

  hydrate: async () => {
    const token = await AsyncStorage.getItem('auth_token');
    if (token) {
      set({ token });
      await get().checkAuth();
    }
    set({ hydrated: true });
  },

  login: async (email, password) => {
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
      await AsyncStorage.setItem('auth_token', data.token);
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
      set({ isLoading: false, error: 'Network error. Please try again.' });
      return false;
    }
  },

  ssoLogin: async (email) => {
    // On mobile, SSO opens an in-app browser (react-native-inappbrowser-reborn)
    // The OAuth redirect scheme is: qcrm://auth/callback
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_URL}/api/auth/sso-url?email=${encodeURIComponent(email)}`);
      const { url } = await res.json();
      // InAppBrowser opens the Microsoft OAuth URL; deep link handles the callback
      const { InAppBrowser } = await import('react-native-inappbrowser-reborn');
      if (await InAppBrowser.isAvailable()) {
        const result = await InAppBrowser.openAuth(url, 'qcrm://auth/callback', {
          showTitle: false,
          enableUrlBarHiding: true,
          enableDefaultShare: false,
        });
        if (result.type === 'success' && result.url) {
          const code = new URL(result.url).searchParams.get('code');
          if (code) {
            return get().handleSsoCallback(code);
          }
        }
      }
      set({ isLoading: false, error: 'SSO failed' });
      return false;
    } catch {
      set({ isLoading: false, error: 'SSO error' });
      return false;
    }
  },

  handleSsoCallback: async (code: string) => {
    const res = await fetch(`${API_URL}/api/auth/sso-callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) {
      set({ isLoading: false, error: 'SSO callback failed' });
      return false;
    }
    const data = await res.json();
    await AsyncStorage.setItem('auth_token', data.token);
    set({ user: data.user, token: data.token, isAuthenticated: true, isLoading: false });
    return true;
  },

  logout: async () => {
    await AsyncStorage.removeItem('auth_token');
    set({ user: null, token: null, isAuthenticated: false });
  },

  checkAuth: async () => {
    const token = await AsyncStorage.getItem('auth_token');
    if (!token) { set({ isAuthenticated: false }); return false; }
    try {
      const res = await fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { await AsyncStorage.removeItem('auth_token'); set({ isAuthenticated: false }); return false; }
      const user = await res.json();
      set({ user, isAuthenticated: true, token });
      return true;
    } catch {
      return false;
    }
  },

  hasPermission: (permission) => {
    const { user } = get();
    return user?.role?.permissions?.includes(permission) ?? false;
  },

  hasAnyPermission: (permissions) => {
    const { user } = get();
    return permissions.some(p => user?.role?.permissions?.includes(p) ?? false);
  },

  clearError: () => set({ error: null }),
}));
```

### 1.3 Utility Functions

`src/lib/utils.ts` — remove `clsx`/`twMerge` (not applicable in RN), keep the rest unchanged:

```typescript
// formatCurrency, formatDate, formatDateTime, formatRelativeTime, truncate, slugify, capitalizeFirst
// — exact same implementations as web app (no browser APIs used)
// Remove: cn() function (not needed in React Native)
```

`src/lib/gom-calculator.ts` and `src/lib/rate-cards.ts` — **copy verbatim**, no changes required. Both files contain pure math functions with no browser dependencies.

### 1.4 React Query Setup

`src/lib/query-client.ts`:

```typescript
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,       // 5 minutes
      gcTime: 1000 * 60 * 10,          // 10 minutes
      retry: 2,
      refetchOnWindowFocus: false,     // No window in RN
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
});
```

---

## Phase 2: Design System

### 2.1 Color Palette

`src/theme/colors.ts` — derived from Tailwind config in the web app:

```typescript
export const Colors = {
  // Primary (Sky Blue — matches primary.500–700 in tailwind.config.ts)
  primary: {
    50:  '#f0f9ff',
    100: '#e0f2fe',
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#0ea5e9',
    600: '#0284c7',
    700: '#0369a1',
    800: '#075985',
    900: '#0c4a6e',
  },
  // Secondary (Purple)
  secondary: {
    500: '#a855f7',
    600: '#9333ea',
    700: '#7e22ce',
  },
  // Success (Green)
  success: {
    50:  '#f0fdf4',
    100: '#dcfce7',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
  },
  // Warning (Amber)
  warning: {
    50:  '#fffbeb',
    100: '#fef3c7',
    500: '#f59e0b',
    600: '#d97706',
  },
  // Danger (Red)
  danger: {
    50:  '#fef2f2',
    100: '#fee2e2',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
  },
  // Neutrals (Slate)
  neutral: {
    50:  '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
    950: '#020617',
  },
  // Semantic
  background: {
    primary:   '#0f172a',   // slate-900 — matches web dark background
    secondary: '#1e293b',   // slate-800
    card:      '#1e293b',
    elevated:  '#334155',
  },
  text: {
    primary:   '#f8fafc',
    secondary: '#94a3b8',
    muted:     '#475569',
    inverse:   '#0f172a',
  },
  border: {
    default: '#334155',
    muted:   '#1e293b',
    focus:   '#0ea5e9',
  },
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',
} as const;
```

### 2.2 Typography Scale

`src/theme/typography.ts`:

```typescript
import { Platform } from 'react-native';

const fontFamily = Platform.select({
  ios:     { regular: 'System', medium: 'System', bold: 'System', mono: 'Courier New' },
  android: { regular: 'Roboto', medium: 'Roboto-Medium', bold: 'Roboto-Bold', mono: 'monospace' },
}) ?? { regular: 'System', medium: 'System', bold: 'System', mono: 'monospace' };

export const Typography = {
  fontFamily,
  fontSize: {
    xs:   10,
    sm:   12,
    base: 14,
    md:   15,
    lg:   16,
    xl:   18,
    '2xl': 20,
    '3xl': 24,
    '4xl': 28,
    '5xl': 32,
  },
  fontWeight: {
    normal:    '400' as const,
    medium:    '500' as const,
    semibold:  '600' as const,
    bold:      '700' as const,
    extrabold: '800' as const,
  },
  lineHeight: {
    tight:  1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
};
```

### 2.3 Spacing System

`src/theme/spacing.ts`:

```typescript
export const Spacing = {
  0:   0,
  0.5: 2,
  1:   4,
  1.5: 6,
  2:   8,
  2.5: 10,
  3:   12,
  3.5: 14,
  4:   16,
  5:   20,
  6:   24,
  7:   28,
  8:   32,
  9:   36,
  10:  40,
  12:  48,
  14:  56,
  16:  64,
  20:  80,
  24:  96,
} as const;
```

### 2.4 Unified Theme Object

`src/theme/theme.ts`:

```typescript
import { Colors } from './colors';
import { Typography } from './typography';
import { Spacing } from './spacing';

export const theme = {
  colors: Colors,
  typography: Typography,
  spacing: Spacing,
  borderRadius: {
    sm: 4,
    base: 8,
    md: 10,
    lg: 12,
    xl: 16,
    '2xl': 20,
    full: 9999,
  },
  shadow: {
    sm:  { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
    md:  { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, elevation: 4 },
    lg:  { shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 16, elevation: 8 },
  },
};

export type Theme = typeof theme;
```

### 2.5 Base Component Specifications

| Component | Package | Mobile Adaptation |
|---|---|---|
| `Button` | `react-native-paper@5.12.5` `Button` | `TouchableOpacity` with `ActivityIndicator` for loading state |
| `TextInput` | `react-native-paper@5.12.5` `TextInput` | `secureTextEntry` for password, `keyboardType` for email/numeric |
| `Card` | Custom `View` + `shadow` | `Pressable` wrapper for tap feedback |
| `Badge` | Custom `View` + `Text` | Status dot + label, no hover states |
| `Modal` | `react-native` `Modal` | Full-screen on mobile, `StatusBar` hidden |
| `BottomSheet` | `@gorhom/bottom-sheet@4.6.4` | Replaces web dropdowns, filter panels, CRUD forms |
| `Tabs` | Custom `ScrollView` + `Pressable` | Horizontally scrollable for 6+ tabs (Opportunity Detail) |
| `Spinner` | `react-native` `ActivityIndicator` | Centered with optional overlay |
| `Avatar` | `react-native-paper@5.12.5` `Avatar` | Initials fallback when no image |
| `Select` | `@gorhom/bottom-sheet` + `FlatList` | Replaces web `<select>` dropdowns |
| `Switch` | `react-native` `Switch` | `trackColor` and `thumbColor` from theme |
| `Divider` | `react-native-paper@5.12.5` `Divider` | Horizontal rule |
| `Toast` | Custom with `Animated` | Appears over content, auto-dismiss 3s |
| `IconButton` | `react-native-paper@5.12.5` `IconButton` | `rippleColor` for tap feedback |
| `SkeletonLoader` | Custom `Animated` shimmer | Replaces content during loading |

---

## Phase 3: Navigation Architecture

### 3.1 Root Navigator — `App.tsx`

```typescript
import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import { navigationRef } from '@lib/api';
import { queryClient } from '@lib/query-client';
import { AppNavigator } from '@navigation/AppNavigator';
import { useAuthStore } from '@lib/auth-store';
import { theme } from '@theme/theme';
import { linking } from '@navigation/linking';

export default function App(): React.JSX.Element {
  const { hydrate, hydrated } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, []);

  if (!hydrated) return null; // Splash screen shown by RN until hydrated

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <PaperProvider>
            <StatusBar barStyle="light-content" backgroundColor={theme.colors.background.primary} />
            <NavigationContainer ref={navigationRef} linking={linking}>
              <AppNavigator />
            </NavigationContainer>
          </PaperProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

### 3.2 Type Definitions

`src/types/index.ts`:

```typescript
export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Opportunities: undefined;
  Contacts: undefined;
  Analytics: undefined;
  More: undefined;
};

export type OpportunitiesStackParamList = {
  OpportunitiesList: undefined;
  OpportunityDetail: { id: string; name?: string };
  NewOpportunity: undefined;
  KanbanView: undefined;
};

export type MoreStackParamList = {
  MoreMenu: undefined;
  Gom: undefined;
  Agents: undefined;
  Settings: undefined;
};
```

### 3.3 App Navigator (Auth Gate)

`src/navigation/AppNavigator.tsx`:

```typescript
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuthStore } from '@lib/auth-store';
import { LoginScreen } from '@screens/auth/LoginScreen';
import { MainTabNavigator } from './MainTabNavigator';
import type { RootStackParamList } from '@/types';

const Stack = createStackNavigator<RootStackParamList>();

export function AppNavigator() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animationEnabled: true }}>
      {isAuthenticated ? (
        <Stack.Screen name="Main" component={MainTabNavigator} />
      ) : (
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ animationTypeForReplace: 'pop' }}
        />
      )}
    </Stack.Navigator>
  );
}
```

### 3.4 Main Tab Navigator

`src/navigation/MainTabNavigator.tsx`:

```typescript
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { DashboardScreen } from '@screens/dashboard/DashboardScreen';
import { OpportunitiesStack } from './OpportunitiesStack';
import { ContactsScreen } from '@screens/contacts/ContactsScreen';
import { AnalyticsScreen } from '@screens/analytics/AnalyticsScreen';
import { MoreStack } from './MoreStack';
import { theme } from '@theme/theme';
import type { MainTabParamList } from '@/types';

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.background.secondary,
          borderTopColor: theme.colors.border.default,
          height: 64,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: theme.colors.primary[500],
        tabBarInactiveTintColor: theme.colors.text.muted,
        tabBarIcon: ({ color, size }) => {
          const icons: Record<string, string> = {
            Dashboard: 'view-dashboard',
            Opportunities: 'briefcase',
            Contacts: 'account-group',
            Analytics: 'chart-line',
            More: 'dots-horizontal',
          };
          return <Icon name={icons[route.name]} color={color} size={size} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Opportunities" component={OpportunitiesStack} />
      <Tab.Screen name="Contacts" component={ContactsScreen} />
      <Tab.Screen name="Analytics" component={AnalyticsScreen} />
      <Tab.Screen name="More" component={MoreStack} />
    </Tab.Navigator>
  );
}
```

### 3.5 Deep Linking Schema

`src/navigation/linking.ts`:

```typescript
import { LinkingOptions } from '@react-navigation/native';

export const linking: LinkingOptions<any> = {
  prefixes: ['qcrm://', 'https://qcrm.qbadvisory.com'],
  config: {
    screens: {
      Login: 'login',
      'auth/callback': 'auth/callback',
      Main: {
        screens: {
          Dashboard: 'dashboard',
          Opportunities: {
            screens: {
              OpportunitiesList: 'opportunities',
              OpportunityDetail: 'opportunities/:id',
              NewOpportunity: 'opportunities/new',
            },
          },
          Contacts: 'contacts',
          Analytics: 'analytics',
          More: {
            screens: {
              Gom: 'gom',
              Agents: 'agents',
              Settings: 'settings',
            },
          },
        },
      },
    },
  },
};
```

---

## Phase 4: Screen Implementation

### 4.1 Screen 1 — Login Screen

**File**: `src/screens/auth/LoginScreen.tsx`  
**API Endpoints**: `POST /api/auth/login`, `GET /api/auth/sso-url`  
**State**: Zustand `useAuthStore`, local `useState` for form fields  
**Mobile adaptations**:
- Web gradient background → `LinearGradient` from `react-native-linear-gradient`
- Web `motion.div` animations → `Animated.Value` with timing/spring
- Web HTML form submit → `handleSubmit` wired to `TextInput` `onSubmitEditing` + `returnKeyType="next"`
- Password visibility toggle via `secureTextEntry` prop
- `KeyboardAvoidingView` wraps the form to prevent keyboard overlap
- Microsoft SSO → `InAppBrowser.openAuth()` instead of `window.location.href`

```typescript
import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuthStore } from '@lib/auth-store';
import { theme } from '@theme/theme';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@/types';

type LoginNavProp = StackNavigationProp<RootStackParamList, 'Login'>;

export function LoginScreen() {
  const navigation = useNavigation<LoginNavProp>();
  const { login, ssoLogin, isLoading, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const isSSO = email.toLowerCase().endsWith('@qbadvisory.com');

  const handleSubmit = async () => {
    clearError();
    let success: boolean;
    if (isSSO) {
      success = await ssoLogin(email);
    } else {
      success = await login(email, password);
    }
    // Navigation handled automatically by AppNavigator re-render on isAuthenticated change
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Logo + Title */}
          <View style={styles.header}>
            <View style={styles.logoBox}>
              <Icon name="briefcase-variant" color={theme.colors.primary[400]} size={36} />
            </View>
            <Text style={styles.title}>Q-CRM</Text>
            <Text style={styles.subtitle}>Sign in to your account</Text>
          </View>

          {/* Error Banner */}
          {!!error && (
            <View style={styles.errorBanner}>
              <Icon name="alert-circle" color={theme.colors.danger[400]} size={16} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Email */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputWrapper}>
              <Icon name="email-outline" color={theme.colors.text.secondary} size={18} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="you@company.com"
                placeholderTextColor={theme.colors.text.muted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                returnKeyType={isSSO ? 'go' : 'next'}
                onSubmitEditing={() => isSSO ? handleSubmit() : passwordRef.current?.focus()}
              />
            </View>
          </View>

          {/* Password (hidden for SSO) */}
          {!isSSO && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrapper}>
                <Icon name="lock-outline" color={theme.colors.text.secondary} size={18} style={styles.inputIcon} />
                <TextInput
                  ref={passwordRef}
                  style={[styles.input, styles.inputFlex]}
                  placeholder="••••••••"
                  placeholderTextColor={theme.colors.text.muted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                  returnKeyType="go"
                  onSubmitEditing={handleSubmit}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                  <Icon name={showPassword ? 'eye-off' : 'eye'} color={theme.colors.text.secondary} size={18} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading
              ? <ActivityIndicator color="#fff" size="small" />
              : <>
                  <Text style={styles.submitText}>{isSSO ? 'Continue with Microsoft' : 'Sign In'}</Text>
                  <Icon name={isSSO ? 'microsoft' : 'arrow-right'} color="#fff" size={18} style={{ marginLeft: 6 }} />
                </>
            }
          </TouchableOpacity>

          {/* SSO Indicator */}
          {isSSO && (
            <View style={styles.ssoNote}>
              <Icon name="shield-check" color={theme.colors.primary[400]} size={14} />
              <Text style={styles.ssoNoteText}>Microsoft SSO detected for @qbadvisory.com accounts</Text>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: theme.colors.background.primary },
  kav:           { flex: 1 },
  scroll:        { flexGrow: 1, justifyContent: 'center', padding: theme.spacing[6] },
  header:        { alignItems: 'center', marginBottom: theme.spacing[8] },
  logoBox:       { width: 72, height: 72, borderRadius: 20, backgroundColor: theme.colors.primary[900], justifyContent: 'center', alignItems: 'center', marginBottom: theme.spacing[4] },
  title:         { fontSize: 28, fontWeight: '700', color: theme.colors.text.primary, marginBottom: 4 },
  subtitle:      { fontSize: 14, color: theme.colors.text.secondary },
  errorBanner:   { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.danger[900] + '33', borderWidth: 1, borderColor: theme.colors.danger[700], borderRadius: 8, padding: 12, marginBottom: 16, gap: 8 },
  errorText:     { color: theme.colors.danger[400], fontSize: 13, flex: 1 },
  inputGroup:    { marginBottom: theme.spacing[4] },
  label:         { color: theme.colors.text.secondary, fontSize: 13, fontWeight: '500', marginBottom: 6 },
  inputWrapper:  { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.background.secondary, borderWidth: 1, borderColor: theme.colors.border.default, borderRadius: 10, paddingHorizontal: 12, height: 48 },
  inputIcon:     { marginRight: 8 },
  input:         { flex: 1, color: theme.colors.text.primary, fontSize: 15 },
  inputFlex:     { flex: 1 },
  eyeBtn:        { padding: 4 },
  submitBtn:     { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.primary[600], borderRadius: 10, height: 52, marginTop: theme.spacing[2] },
  submitBtnDisabled: { opacity: 0.6 },
  submitText:    { color: '#fff', fontSize: 16, fontWeight: '600' },
  ssoNote:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12, gap: 6 },
  ssoNoteText:   { color: theme.colors.primary[400], fontSize: 12 },
});
```

---

### 4.2 Screen 2 — Dashboard Screen

**File**: `src/screens/dashboard/DashboardScreen.tsx`  
**API Endpoints**: `GET /api/analytics/dashboard`, `GET /api/analytics/intelligence`  
**State**: React Query `useQuery`, local state for selected period  
**Mobile adaptations**:
- Web 4-column KPI grid → 2×2 `FlatList` with `numColumns={2}`  
- Web Recharts revenue chart → `react-native-gifted-charts` `BarChart`  
- Web AI insights panel → `ScrollView` with expandable `Card` components  
- Web hover tooltips → `LongPressGestureHandler` shows value overlay  
- Pull-to-refresh with `RefreshControl`  
- Skeleton loaders during initial fetch  

```typescript
import React, { useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@lib/api';
import { theme } from '@theme/theme';
import { SkeletonLoader } from '@components/common/SkeletonLoader';
import { BarChart } from 'react-native-gifted-charts';

interface KpiData {
  label: string;
  value: string;
  change: number;
  icon: string;
  color: string;
}

export function DashboardScreen() {
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiClient<{ kpis: KpiData[]; revenueChart: any[]; insights: any[] }>('/api/analytics/dashboard'),
  });

  const kpis = data?.kpis ?? [];

  const renderKpi = ({ item }: { item: KpiData }) => (
    <View style={[styles.kpiCard, { borderLeftColor: item.color }]}>
      <Text style={styles.kpiLabel}>{item.label}</Text>
      <Text style={styles.kpiValue}>{item.value}</Text>
      <Text style={[styles.kpiChange, { color: item.change >= 0 ? theme.colors.success[500] : theme.colors.danger[500] }]}>
        {item.change >= 0 ? '↑' : '↓'} {Math.abs(item.change)}%
      </Text>
    </View>
  );

  if (isLoading) return <SkeletonLoader type="dashboard" />;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.primary[400]} />}
        contentContainerStyle={styles.scroll}
      >
        <Text style={styles.pageTitle}>Dashboard</Text>

        {/* KPI Grid — 2 columns */}
        <FlatList
          data={kpis}
          renderItem={renderKpi}
          keyExtractor={(item) => item.label}
          numColumns={2}
          columnWrapperStyle={styles.kpiRow}
          scrollEnabled={false}
          style={styles.kpiGrid}
        />

        {/* Revenue Bar Chart */}
        <View style={styles.chartCard}>
          <Text style={styles.sectionTitle}>Monthly Revenue</Text>
          <BarChart
            data={data?.revenueChart?.map(d => ({ value: d.revenue, label: d.month })) ?? []}
            barWidth={28}
            barBorderRadius={4}
            frontColor={theme.colors.primary[500]}
            gradientColor={theme.colors.primary[700]}
            isAnimated
            hideRules
            xAxisLabelTextStyle={{ color: theme.colors.text.secondary, fontSize: 10 }}
            yAxisTextStyle={{ color: theme.colors.text.secondary, fontSize: 10 }}
            backgroundColor={theme.colors.background.card}
          />
        </View>

        {/* AI Insights */}
        {data?.insights?.map((insight, i) => (
          <View key={i} style={styles.insightCard}>
            <Text style={styles.insightTitle}>{insight.title}</Text>
            <Text style={styles.insightBody}>{insight.body}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: theme.colors.background.primary },
  scroll:       { padding: theme.spacing[4] },
  pageTitle:    { fontSize: 22, fontWeight: '700', color: theme.colors.text.primary, marginBottom: 16 },
  kpiGrid:      { marginBottom: 16 },
  kpiRow:       { justifyContent: 'space-between', marginBottom: 12 },
  kpiCard:      { flex: 0.48, backgroundColor: theme.colors.background.card, borderRadius: 12, padding: 14, borderLeftWidth: 3 },
  kpiLabel:     { fontSize: 11, color: theme.colors.text.secondary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  kpiValue:     { fontSize: 20, fontWeight: '700', color: theme.colors.text.primary, marginBottom: 2 },
  kpiChange:    { fontSize: 12, fontWeight: '500' },
  chartCard:    { backgroundColor: theme.colors.background.card, borderRadius: 12, padding: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: theme.colors.text.primary, marginBottom: 12 },
  insightCard:  { backgroundColor: theme.colors.background.card, borderRadius: 12, padding: 14, marginBottom: 10 },
  insightTitle: { fontSize: 13, fontWeight: '600', color: theme.colors.primary[400], marginBottom: 4 },
  insightBody:  { fontSize: 13, color: theme.colors.text.secondary, lineHeight: 18 },
});
```

---

### 4.3 Screen 3 — Opportunities List + Kanban

**File**: `src/screens/opportunities/OpportunitiesScreen.tsx`  
**API Endpoints**: `GET /api/opportunities?page=&limit=&search=&stage=`  
**State**: Zustand `useOpportunityStore` + local `useState` for search/filter/viewMode  
**Mobile adaptations**:
- Web sortable table → `FlatList` of `OpportunityCard` components  
- Web kanban columns → horizontal `ScrollView` with vertical `FlatList` per column (draggable via `react-native-draggable-flatlist@4.0.1`)  
- Web search bar in header → sticky `TextInput` above `FlatList`  
- Web pagination buttons → `FlatList` `onEndReached` infinite scroll (append-mode)  
- Web "Add Opportunity" FAB → `FAB` from `react-native-paper` positioned absolutely  
- Sort: replaced by filter bottom sheet (tap funnel icon)  
- Stage filter chips: horizontally scrollable row above list  

```typescript
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FAB } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useOpportunityStore } from '@store/opportunity-store';
import { OpportunityCard } from '@components/opportunities/OpportunityCard';
import { theme } from '@theme/theme';
import { useCurrency } from '@lib/currency-context';
import type { OpportunitiesStackParamList } from '@/types';
import { useDebounce } from '@hooks/useDebounce';

const STAGES = ['All', 'Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'];

type NavProp = StackNavigationProp<OpportunitiesStackParamList, 'OpportunitiesList'>;

export function OpportunitiesScreen() {
  const navigation = useNavigation<NavProp>();
  const { opportunities, fetchOpportunities, total, isLoading } = useOpportunityStore();
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    setPage(1);
    fetchOpportunities({ page: 1, limit: 20, search: debouncedSearch, stage: stageFilter === 'All' ? undefined : stageFilter });
  }, [debouncedSearch, stageFilter]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || opportunities.length >= total) return;
    setIsLoadingMore(true);
    const nextPage = page + 1;
    await fetchOpportunities({ page: nextPage, limit: 20, search: debouncedSearch, stage: stageFilter === 'All' ? undefined : stageFilter });
    setPage(nextPage);
    setIsLoadingMore(false);
  }, [page, isLoadingMore, total, opportunities.length, debouncedSearch, stageFilter]);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Opportunities</Text>
        <TouchableOpacity onPress={() => navigation.navigate('KanbanView')} style={styles.viewToggle}>
          <Icon name="view-column" color={theme.colors.primary[400]} size={22} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchRow}>
        <Icon name="magnify" color={theme.colors.text.muted} size={18} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search opportunities..."
          placeholderTextColor={theme.colors.text.muted}
          value={search}
          onChangeText={setSearch}
        />
        {!!search && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Icon name="close-circle" color={theme.colors.text.muted} size={18} />
          </TouchableOpacity>
        )}
      </View>

      {/* Stage filter chips */}
      <FlatList
        horizontal
        data={STAGES}
        keyExtractor={(s) => s}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => setStageFilter(item)}
            style={[styles.chip, stageFilter === item && styles.chipActive]}
          >
            <Text style={[styles.chipText, stageFilter === item && styles.chipTextActive]}>{item}</Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.chipRow}
        showsHorizontalScrollIndicator={false}
      />

      {/* Opportunities List */}
      <FlatList
        data={opportunities}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <OpportunityCard
            opportunity={item}
            onPress={() => navigation.navigate('OpportunityDetail', { id: item.id, name: item.name })}
          />
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isLoading && page === 1}
            onRefresh={() => fetchOpportunities({ page: 1, limit: 20, search: debouncedSearch })}
            tintColor={theme.colors.primary[400]}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={isLoadingMore ? <ActivityIndicator color={theme.colors.primary[400]} style={{ padding: 16 }} /> : null}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Icon name="briefcase-off" color={theme.colors.text.muted} size={48} />
              <Text style={styles.emptyText}>No opportunities found</Text>
            </View>
          ) : null
        }
      />

      {/* FAB */}
      <FAB
        icon="plus"
        style={styles.fab}
        color="#fff"
        onPress={() => navigation.navigate('NewOpportunity')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: theme.colors.background.primary },
  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: theme.spacing[4], paddingBottom: 8 },
  title:         { fontSize: 22, fontWeight: '700', color: theme.colors.text.primary },
  viewToggle:    { padding: 6 },
  searchRow:     { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.background.secondary, borderRadius: 10, marginHorizontal: 16, marginBottom: 10, paddingHorizontal: 12, height: 42 },
  searchIcon:    { marginRight: 8 },
  searchInput:   { flex: 1, color: theme.colors.text.primary, fontSize: 14 },
  chipRow:       { paddingHorizontal: 16, gap: 8, paddingBottom: 10 },
  chip:          { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: theme.colors.background.secondary, borderWidth: 1, borderColor: theme.colors.border.default },
  chipActive:    { backgroundColor: theme.colors.primary[800], borderColor: theme.colors.primary[500] },
  chipText:      { fontSize: 12, color: theme.colors.text.secondary, fontWeight: '500' },
  chipTextActive:{ color: theme.colors.primary[300] },
  list:          { paddingHorizontal: 16, paddingBottom: 90 },
  empty:         { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText:     { color: theme.colors.text.secondary, fontSize: 14 },
  fab:           { position: 'absolute', right: 20, bottom: 24, backgroundColor: theme.colors.primary[600] },
});
```

---

### 4.4 Screen 4 — Opportunity Detail (6 Tabs)

**File**: `src/screens/opportunities/OpportunityDetailScreen.tsx`  
**Route params**: `{ id: string }`  
**API Endpoints**: `GET /api/opportunities/:id`, `GET /api/opportunities/:id/gom`, `PATCH /api/opportunities/:id`, `POST /api/opportunities/:id/comments`  
**Mobile adaptations**:
- 6 web tabs → horizontally **scrollable** `TabBar` (tabs: Project Details, Presales, GOM Calculator, Resources, Sales, Project, Comments)  
- Tab content uses `PagerView` from `react-native-pager-view@6.4.1` for swipe-between-tabs  
- Web editable inline fields → tap-to-edit approach with `BottomSheet` editor  
- GOM summary numbers in cards (same layout as web, 2-column grid)  
- Resource table → `FlatList` of resource rows  
- Comments/Audit → `FlatList` with timestamp, user avatar, message  
- "Request GOM Approval" button → `Alert.alert` confirmation before API call  

```typescript
import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PagerView from 'react-native-pager-view';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoute } from '@react-navigation/native';
import { apiClient } from '@lib/api';
import { theme } from '@theme/theme';

const TABS = ['Details', 'Presales', 'GOM', 'Resources', 'Sales', 'Project', 'Comments'];

export function OpportunityDetailScreen() {
  const { params } = useRoute<any>();
  const { id } = params;
  const [activeTab, setActiveTab] = useState(0);
  const pagerRef = useRef<PagerView>(null);
  const qc = useQueryClient();

  const { data: opp } = useQuery({
    queryKey: ['opportunity', id],
    queryFn: () => apiClient(`/api/opportunities/${id}`),
  });

  const requestApproval = useMutation({
    mutationFn: () => apiClient(`/api/opportunities/${id}/gom-approval`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['opportunity', id] }),
  });

  const handleApprovalRequest = () => {
    Alert.alert(
      'Request GOM Approval',
      'Submit this GOM for approval? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Submit', onPress: () => requestApproval.mutate() },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Tab Bar — horizontally scrollable */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
        {TABS.map((tab, i) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === i && styles.tabActive]}
            onPress={() => { setActiveTab(i); pagerRef.current?.setPage(i); }}
          >
            <Text style={[styles.tabText, activeTab === i && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Swipeable Tab Content */}
      <PagerView
        ref={pagerRef}
        style={{ flex: 1 }}
        initialPage={0}
        onPageSelected={(e) => setActiveTab(e.nativeEvent.position)}
      >
        {/* Page 0: Project Details */}
        <ScrollView key="0" contentContainerStyle={styles.page}>
          <Text style={styles.sectionTitle}>{opp?.name}</Text>
          {/* Detail rows: Client, Stage, Value, Probability, etc. */}
          {[
            ['Client', opp?.client],
            ['Stage', opp?.stage],
            ['Value', opp?.value ? `$${Number(opp.value).toLocaleString()}` : '—'],
            ['Probability', opp?.probability ? `${opp.probability}%` : '—'],
            ['Region', opp?.region ?? '—'],
            ['Technology', opp?.technology ?? '—'],
          ].map(([label, value]) => (
            <View key={label} style={styles.detailRow}>
              <Text style={styles.detailLabel}>{label}</Text>
              <Text style={styles.detailValue}>{value}</Text>
            </View>
          ))}
        </ScrollView>

        {/* Page 1: Presales */}
        <ScrollView key="1" contentContainerStyle={styles.page}>
          <Text style={styles.sectionTitle}>Presales Details</Text>
          {/* Presales fields */}
        </ScrollView>

        {/* Page 2: GOM Calculator */}
        <ScrollView key="2" contentContainerStyle={styles.page}>
          <Text style={styles.sectionTitle}>GOM Calculator</Text>
          {/* GOM summary cards */}
          {opp?.gomSummary && (
            <View style={styles.gomGrid}>
              {[
                ['Total Revenue', `$${Number(opp.gomSummary.totalRevenue).toLocaleString()}`],
                ['Total Cost', `$${Number(opp.gomSummary.totalCost).toLocaleString()}`],
                ['GOM $', `$${Number(opp.gomSummary.gomFull).toLocaleString()}`],
                ['GOM %', `${opp.gomSummary.gomPercent?.toFixed(1)}%`],
              ].map(([label, value]) => (
                <View key={label} style={styles.gomCard}>
                  <Text style={styles.gomCardLabel}>{label}</Text>
                  <Text style={styles.gomCardValue}>{value}</Text>
                </View>
              ))}
            </View>
          )}
          {/* Request approval button — only if not yet approved */}
          {opp?.gomStatus !== 'approved' && (
            <TouchableOpacity style={styles.approvalBtn} onPress={handleApprovalRequest}>
              <Text style={styles.approvalBtnText}>Request GOM Approval</Text>
            </TouchableOpacity>
          )}
          {opp?.gomStatus === 'approved' && (
            <View style={styles.approvedBadge}>
              <Text style={styles.approvedBadgeText}>✓ GOM Approved</Text>
            </View>
          )}
        </ScrollView>

        {/* Pages 3–6: Resources, Sales, Project, Comments (same pattern) */}
        {['Resources', 'Sales', 'Project', 'Comments'].map((label, i) => (
          <ScrollView key={String(i + 3)} contentContainerStyle={styles.page}>
            <Text style={styles.sectionTitle}>{label}</Text>
          </ScrollView>
        ))}
      </PagerView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: theme.colors.background.primary },
  tabBar:           { borderBottomWidth: 1, borderBottomColor: theme.colors.border.default, maxHeight: 48 },
  tabBarContent:    { paddingHorizontal: 12, gap: 4 },
  tab:              { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive:        { borderBottomColor: theme.colors.primary[500] },
  tabText:          { fontSize: 13, fontWeight: '500', color: theme.colors.text.secondary },
  tabTextActive:    { color: theme.colors.primary[400] },
  page:             { padding: 16 },
  sectionTitle:     { fontSize: 16, fontWeight: '700', color: theme.colors.text.primary, marginBottom: 16 },
  detailRow:        { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.border.muted },
  detailLabel:      { fontSize: 13, color: theme.colors.text.secondary, fontWeight: '500' },
  detailValue:      { fontSize: 13, color: theme.colors.text.primary, fontWeight: '600', flex: 1, textAlign: 'right' },
  gomGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  gomCard:          { flex: 1, minWidth: '45%', backgroundColor: theme.colors.background.secondary, borderRadius: 10, padding: 14 },
  gomCardLabel:     { fontSize: 11, color: theme.colors.text.secondary, marginBottom: 4, textTransform: 'uppercase' },
  gomCardValue:     { fontSize: 18, fontWeight: '700', color: theme.colors.text.primary },
  approvalBtn:      { backgroundColor: theme.colors.primary[600], borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 8 },
  approvalBtnText:  { color: '#fff', fontWeight: '600', fontSize: 14 },
  approvedBadge:    { backgroundColor: theme.colors.success[700] + '33', borderWidth: 1, borderColor: theme.colors.success[600], borderRadius: 8, padding: 12, alignItems: 'center' },
  approvedBadgeText:{ color: theme.colors.success[400], fontWeight: '600' },
});
```

---

### 4.5 Screen 5 — New Opportunity (4-Step Wizard)

**File**: `src/screens/opportunities/NewOpportunityScreen.tsx`  
**API Endpoints**: `POST /api/opportunities`, `GET /api/master-data/regions`, `GET /api/master-data/technologies`  
**Mobile adaptations**:
- Web 4-column form layout → single column `ScrollView` with `FormField` components  
- Web multi-step wizard navigation → `PagerView` with Back/Next buttons  
- Web date pickers → `react-native-date-picker@4.4.2` modal  
- Web `<select>` dropdowns → `BottomSheet` picker lists  
- `react-hook-form` + `zod` for validation with inline error messages  
- Progress indicator: custom step dots at top of each page  

---

### 4.6 Screen 6 — Contacts

**File**: `src/screens/contacts/ContactsScreen.tsx`  
**API Endpoints**: `GET /api/contacts?page=&search=`, `POST /api/contacts`, `PUT /api/contacts/:id`, `DELETE /api/contacts/:id`  
**Mobile adaptations**:
- Web grid cards → `FlatList` with `numColumns={2}` for tablet, single column on phone  
- Web CRUD modal → `BottomSheet` with `react-hook-form` fields  
- Search bar + letter anchor scroll (like iOS Contacts) via `SectionList`  
- Swipe-to-delete via `react-native-swipeable@1.0.0` on each row  
- Long-press → action sheet (Edit / Delete / Call / Email via `Linking.openURL`)  

---

### 4.7 Screen 7 — Analytics (4 Tabbed Dashboards)

**File**: `src/screens/analytics/AnalyticsScreen.tsx`  
**API Endpoints**: `GET /api/analytics/pipeline`, `GET /api/analytics/performance`, `GET /api/analytics/revenue`, `GET /api/analytics/forecast`  
**Mobile adaptations**:
- 4 web tabs → `ScrollView` horizontal tab bar + `PagerView`  
- Web Recharts `BarChart`, `LineChart`, `PieChart` → `react-native-gifted-charts` equivalents  
- Web drill-down modal (clicking a chart bar) → `BottomSheet` appearing from bottom with detail `FlatList`  
- Web `<table>` data → `FlatList` with column header row  
- Charts are horizontally scrollable when dataset > 6 data points  

---

### 4.8 Screen 8 — GOM Calculator

**File**: `src/screens/gom/GomScreen.tsx`  
**API Endpoints**: `GET /api/rate-cards`, `GET /api/master-data/budget-assumptions`  
**State**: Local `useState` for all calculator inputs; pure functions from `gom-calculator.ts`  
**Mobile adaptations**:
- Web resource table with inline editing → `FlatList` of editable resource rows, each row tap opens `BottomSheet` editor  
- Web "Total Revenue / Cost / GOM" summary bar → sticky footer `View` always visible  
- Numeric inputs use `keyboardType="decimal-pad"`  
- Month column picker uses horizontal `FlatList` of toggleable month chips  
- Add resource navigates to `BottomSheet` with role/location/rate inputs  

---

### 4.9 Screen 9 — Agents Screen

**File**: `src/screens/agents/AgentsScreen.tsx`  
**API Endpoints**: `GET /api/agents`, `POST /api/agents/:id/run`, WebSocket `ws://20.124.178.41:3001/ws/agents/:id`  
**Special considerations**:
- Live terminal console: streaming WebSocket → append lines to `string[]` state, render in `FlatList` (auto-scroll to end via `scrollToEnd()`)  
- Web xterm.js terminal → custom `ScrollView` + `Text` with monospace font (`fontFamily: 'Courier New'`) and dark green on black colors  
- WebSocket managed in `useEffect` cleanup; reconnect on disconnect  
- Agent status badges (running/idle/error) with pulsing `Animated` indicator for "running" state  
- Tap agent card → expands inline terminal; only one expanded at a time  

```typescript
// Key WebSocket pattern for streaming logs:
useEffect(() => {
  const ws = new WebSocket(`ws://20.124.178.41:3001/ws/agents/${agentId}`);
  ws.onmessage = (e) => setLogs(prev => [...prev.slice(-200), e.data]); // keep last 200 lines
  ws.onerror = () => setConnectionStatus('error');
  ws.onopen = () => setConnectionStatus('connected');
  return () => ws.close();
}, [agentId]);
```

---

### 4.10 Screen 10 — Settings (11 Tabs)

**File**: `src/screens/settings/SettingsScreen.tsx`  
**Sub-screens** (each as a separate navigable screen in a `SettingsStack`):
  - `UsersScreen`, `RolesScreen`, `RateCardsScreen`, `MasterDataScreen`, `BudgetAssumptionsScreen`, `EmailTemplatesScreen`, `AuditLogsScreen`, `RegionsScreen`, `TechnologiesScreen`, `PricingModelsScreen`, `ProjectTypesScreen`  
**Mobile adaptations**:
- Web 11-tab sidebar → `SectionList` settings menu (like iOS Settings app) → tap navigates to sub-screen  
- Each sub-screen is a `Stack.Screen` within `SettingsStack`  
- Role + permission matrix: `FlatList` with `Switch` per permission  
- Rate card editor: inline `TextInput` fields with "Save" button  
- Email template editor: `TextInput` `multiline` for HTML body  
- Audit logs: paginated `FlatList` with date range filter via `BottomSheet` date pickers  

---

## Phase 5: Advanced Features

### 5.1 Offline Support

```typescript
// src/services/offline-sync.ts
import SQLite from 'react-native-sqlite-storage';

SQLite.enablePromise(true);

const db = await SQLite.openDatabase({ name: 'qcrm_offline.db', location: 'default' });

// Create offline cache tables
await db.executeSql(`
  CREATE TABLE IF NOT EXISTS opportunities (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    synced_at INTEGER NOT NULL
  )
`);
await db.executeSql(`
  CREATE TABLE IF NOT EXISTS pending_mutations (
    id TEXT PRIMARY KEY,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    body TEXT,
    created_at INTEGER NOT NULL
  )
`);

// On network restore: flush pending_mutations → apiClient → clear table
```

**NetInfo integration** (`@react-native-community/netinfo@11.4.1`):
```typescript
import NetInfo from '@react-native-community/netinfo';
NetInfo.addEventListener(state => {
  if (state.isConnected) syncPendingMutations();
});
```

### 5.2 Push Notifications

```typescript
// src/services/push-notifications.ts
import notifee, { AndroidImportance } from '@notifee/react-native';
import messaging from '@react-native-firebase/messaging';

export async function setupPushNotifications() {
  const authStatus = await messaging().requestPermission();
  if (authStatus !== messaging.AuthorizationStatus.AUTHORIZED) return;

  const token = await messaging().getToken();
  await apiClient('/api/notifications/register', {
    method: 'POST',
    body: JSON.stringify({ token, platform: Platform.OS }),
  });

  // Create notification channel (Android)
  await notifee.createChannel({
    id: 'qcrm_default',
    name: 'Q-CRM Notifications',
    importance: AndroidImportance.HIGH,
  });

  // Handle foreground messages
  messaging().onMessage(async (message) => {
    await notifee.displayNotification({
      title: message.notification?.title ?? 'Q-CRM',
      body: message.notification?.body ?? '',
      android: { channelId: 'qcrm_default' },
    });
  });
}
```

### 5.3 Biometric Authentication

```typescript
// src/services/biometric-auth.ts
import ReactNativeBiometrics, { BiometryTypes } from 'react-native-biometrics';
const rnBiometrics = new ReactNativeBiometrics();

export async function authenticateWithBiometrics(): Promise<boolean> {
  const { biometryType, available } = await rnBiometrics.isSensorAvailable();
  if (!available) return false;

  const { success } = await rnBiometrics.simplePrompt({
    promptMessage: `Sign in with ${biometryType === BiometryTypes.FaceID ? 'Face ID' : 'Fingerprint'}`,
    cancelButtonText: 'Use Password',
  });
  return success;
}
```

### 5.4 File Attachments

```typescript
// Document picker (PDF, DOCX, XLSX)
import DocumentPicker from 'react-native-document-picker';

const pickAndUpload = async (opportunityId: string) => {
  const result = await DocumentPicker.pickSingle({
    type: [DocumentPicker.types.pdf, DocumentPicker.types.doc, DocumentPicker.types.spreadsheet],
  });
  const formData = new FormData();
  formData.append('file', { uri: result.uri, name: result.name, type: result.type } as any);
  await apiClient(`/api/opportunities/${opportunityId}/attachments`, {
    method: 'POST',
    headers: { 'Content-Type': 'multipart/form-data' },
    body: formData,
  });
};

// Image picker (profile photos, contact images)
import { launchImageLibrary } from 'react-native-image-picker';
const pickContactImage = async () => {
  const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
  return result.assets?.[0]?.uri;
};
```

### 5.5 Background Sync

```typescript
// Register background task with react-native-background-fetch@4.2.1
import BackgroundFetch from 'react-native-background-fetch';

BackgroundFetch.configure({ minimumFetchInterval: 15 }, async (taskId) => {
  await syncPendingMutations();
  BackgroundFetch.finish(taskId);
}, (taskId) => {
  BackgroundFetch.finish(taskId);
});
```

---

## Phase 6: Testing & QA

### 6.1 Jest Configuration

**`jest.config.js`**:
```js
module.exports = {
  preset: 'react-native',
  setupFilesAfterFramework: ['@testing-library/react-native/extend-expect'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@lib/(.*)$': '<rootDir>/src/lib/$1',
    '^@screens/(.*)$': '<rootDir>/src/screens/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@theme/(.*)$': '<rootDir>/src/theme/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|react-native-paper|@gorhom|react-native-gifted-charts|react-native-reanimated)/)',
  ],
};
```

### 6.2 Unit Test — Auth Store

**`__tests__/hooks/useAuthStore.test.ts`**:
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '@lib/auth-store';
import { act, renderHook } from '@testing-library/react-native';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

global.fetch = jest.fn();

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, token: null, isAuthenticated: false });
    (fetch as jest.Mock).mockReset();
  });

  it('logs in successfully', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'abc123', user: { id: '1', email: 'test@test.com', name: 'Test', role: { id: 'r1', name: 'Admin', permissions: [] }, roles: [] } }),
    });

    const { result } = renderHook(() => useAuthStore());
    let success: boolean;
    await act(async () => { success = await result.current.login('test@test.com', 'password'); });

    expect(success!).toBe(true);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.email).toBe('test@test.com');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('auth_token', 'abc123');
  });

  it('handles login failure', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Invalid credentials' }),
    });
    const { result } = renderHook(() => useAuthStore());
    let success: boolean;
    await act(async () => { success = await result.current.login('bad@test.com', 'wrong'); });
    expect(success!).toBe(false);
    expect(result.current.error).toBe('Invalid credentials');
  });
});
```

### 6.3 Component Test — OpportunityCard

**`__tests__/components/OpportunityCard.test.tsx`**:
```typescript
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { OpportunityCard } from '@components/opportunities/OpportunityCard';

const mockOpp = { id: '1', name: 'Test Deal', client: 'Acme Corp', value: 500000, stage: 'Proposal', probability: 60, status: 'healthy' as const, owner: 'user1', lastActivity: '2026-03-01' };

describe('OpportunityCard', () => {
  it('renders opportunity details', () => {
    const { getByText } = render(<OpportunityCard opportunity={mockOpp} onPress={() => {}} />);
    expect(getByText('Test Deal')).toBeTruthy();
    expect(getByText('Acme Corp')).toBeTruthy();
    expect(getByText('Proposal')).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(<OpportunityCard opportunity={mockOpp} onPress={onPress} />);
    fireEvent.press(getByTestId('opportunity-card-1'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
```

### 6.4 E2E Tests (Maestro)

**`maestro/login.yaml`**:
```yaml
appId: com.qbadvisory.qcrm
---
- launchApp
- assertVisible: "Q-CRM"
- tapOn: "Email"
- inputText: "admin@test.com"
- tapOn: "Password"
- inputText: "password123"
- tapOn: "Sign In"
- assertVisible: "Dashboard"
- assertNotVisible: "Sign In"
```

**`maestro/opportunities.yaml`**:
```yaml
appId: com.qbadvisory.qcrm
---
- launchApp
- tapOn: "Opportunities"
- assertVisible: "Opportunities"
- tapOn:
    text: "Search opportunities..."
- inputText: "Acme"
- assertVisible: "Acme"
- tapOn:
    index: 0
    text: "Acme"
- assertVisible: "Project Details"
```

### 6.5 Performance Testing

```powershell
# Start Metro profiler
npx react-native start --reset-cache

# Run Flipper for JS heap / network / layout inspection
# Install Flipper: https://fbflipper.com/

# Run Android systrace for native performance
cd android
.\gradlew :app:connectedAndroidTest

# Detox E2E with performance timing
npx detox test --configuration android.att.debug --record-performance all
```

---

## Phase 7: Build & Deploy

### 7.1 EAS Build Setup

```powershell
# Login to Expo EAS (even for bare projects)
eas login

# Initialize EAS in project
eas build:configure
```

**`eas.json`**:
```json
{
  "cli": { "version": ">= 10.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": { "buildType": "apk" },
      "ios": { "simulator": true }
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" },
      "ios": { "enterpriseProvisioning": "adhoc" }
    },
    "production": {
      "android": { "buildType": "aab" },
      "ios": {}
    }
  },
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./secrets/google-play-service-account.json",
        "track": "internal"
      },
      "ios": {
        "appleId": "team@qbadvisory.com",
        "ascAppId": "YOUR_APP_STORE_CONNECT_APP_ID",
        "appleTeamId": "YOUR_APPLE_TEAM_ID"
      }
    }
  }
}
```

### 7.2 Android Build

```powershell
# Local debug build
Set-Location d:\Opportunity\Jaydeep_work\q-crm-mobile\android
.\gradlew assembleDebug

# Release AAB via EAS
eas build --platform android --profile production

# Submit to Play Store
eas submit --platform android --profile production
```

**`android/app/build.gradle`** (key additions):
```groovy
signingConfigs {
    release {
        storeFile file(MYAPP_UPLOAD_STORE_FILE)
        storePassword MYAPP_UPLOAD_STORE_PASSWORD
        keyAlias MYAPP_UPLOAD_KEY_ALIAS
        keyPassword MYAPP_UPLOAD_KEY_PASSWORD
    }
}
```

### 7.3 iOS Build

```powershell
# Install CocoaPods dependencies (run in WSL or on macOS)
# cd ios && pod install

# Cloud build via EAS (no Mac required)
eas build --platform ios --profile production

# Submit to App Store
eas submit --platform ios --profile production
```

**`app.json`** (key fields):
```json
{
  "name": "Q-CRM",
  "displayName": "Q-CRM",
  "version": "1.0.0",
  "android": {
    "applicationId": "com.qbadvisory.qcrm",
    "versionCode": 1,
    "permissions": ["CAMERA", "READ_EXTERNAL_STORAGE", "WRITE_EXTERNAL_STORAGE", "RECEIVE_BOOT_COMPLETED", "VIBRATE", "USE_BIOMETRIC", "USE_FINGERPRINT"]
  },
  "ios": {
    "bundleIdentifier": "com.qbadvisory.qcrm",
    "buildNumber": "1",
    "infoPlist": {
      "NSCameraUsageDescription": "Used to capture profile photos",
      "NSFaceIDUsageDescription": "Used for biometric login",
      "NSPhotoLibraryUsageDescription": "Used to attach images to opportunities"
    }
  }
}
```

### 7.4 CI/CD — GitHub Actions

**`.github/workflows/mobile-ci.yml`**:
```yaml
name: Q-CRM Mobile CI

on:
  push:
    branches: [main, deployment]
    paths:
      - 'Jaydeep_work/q-crm-mobile/**'
  pull_request:
    paths:
      - 'Jaydeep_work/q-crm-mobile/**'

jobs:
  test:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: Jaydeep_work/q-crm-mobile

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js 18
        uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: TypeScript check
        run: npx tsc --noEmit

      - name: ESLint
        run: npx eslint src/ --ext .ts,.tsx --max-warnings 0

      - name: Jest unit tests
        run: npx jest --coverage --ci

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          directory: Jaydeep_work/q-crm-mobile/coverage

  build-android-preview:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    defaults:
      run:
        working-directory: Jaydeep_work/q-crm-mobile

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 18, cache: npm }
      - run: npm ci
      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      - name: Build Android Preview APK
        run: eas build --platform android --profile preview --non-interactive
```

### 7.5 App Store Checklist

**Google Play Store**:
- [ ] AAB built with `buildType: "aab"`
- [ ] App signing key stored in `android/app/*.keystore` (do NOT commit — use `${{ secrets.KEYSTORE }}` in CI)
- [ ] Google Play Service Account JSON created with "Release Manager" role
- [ ] Privacy Policy URL in Play Console
- [ ] Screenshots: Phone (1080×1920), Tablet (1200×1920), min 2 per category
- [ ] App rating questionnaire completed

**Apple App Store**:
- [ ] Provisioning profile + distribution certificate in EAS secrets
- [ ] App Store Connect app created with Bundle ID `com.qbadvisory.qcrm`
- [ ] TestFlight internal testing before production release
- [ ] Privacy Nutrition Labels filled in App Store Connect
- [ ] Screenshots: iPhone 6.7" (1290×2796) required

---

## Appendix A — Package Version Lockfile Summary

| Package | Version | Purpose |
|---|---|---|
| `react-native` | `0.75.0` | Core framework |
| `typescript` | `5.6.0` | Type safety |
| `@react-navigation/native` | `6.1.18` | Navigation |
| `@react-navigation/stack` | `6.4.1` | Stack navigator |
| `@react-navigation/bottom-tabs` | `6.6.1` | Tab bar |
| `@react-navigation/drawer` | `6.7.2` | Drawer (Settings) |
| `react-native-screens` | `3.34.0` | Native screen optimization |
| `react-native-safe-area-context` | `4.13.1` | Safe area insets |
| `react-native-gesture-handler` | `2.20.2` | Gesture system |
| `react-native-reanimated` | `3.16.1` | Animations |
| `zustand` | `4.5.5` | Global state |
| `@tanstack/react-query` | `5.59.0` | Server state / caching |
| `@react-native-async-storage/async-storage` | `1.24.0` | Persistent key-value storage |
| `react-native-paper` | `5.12.5` | UI components |
| `react-native-vector-icons` | `10.2.0` | Icons |
| `@gorhom/bottom-sheet` | `4.6.4` | Bottom sheets |
| `react-native-gifted-charts` | `1.4.4` | Charts |
| `react-hook-form` | `7.53.2` | Form management |
| `zod` | `3.23.8` | Schema validation |
| `react-native-date-picker` | `4.4.2` | Date picker |
| `@notifee/react-native` | `9.1.6` | Local + push notifications |
| `react-native-sqlite-storage` | `6.0.1` | Offline DB |
| `react-native-biometrics` | `3.0.1` | Biometric auth |
| `react-native-document-picker` | `9.3.1` | Document attachments |
| `react-native-image-picker` | `7.1.2` | Image attachments |
| `react-native-config` | `1.5.3` | Env variables |
| `react-native-pager-view` | `6.4.1` | Swipeable tab content |
| `react-native-inappbrowser-reborn` | `3.7.0` | SSO OAuth browser |
| `@react-native-community/netinfo` | `11.4.1` | Network state |
| `react-native-background-fetch` | `4.2.1` | Background sync |
| `react-native-draggable-flatlist` | `4.0.1` | Kanban drag-and-drop |
| `@react-native-firebase/app` | `21.0.0` | Firebase core |
| `@react-native-firebase/messaging` | `21.0.0` | FCM push notifications |
| `eas-cli` | `10.0.0` | EAS Build & Submit |

---

## Appendix B — Key Mobile Adaptation Reference

| Web Pattern | Mobile Equivalent |
|---|---|
| `localStorage.getItem/setItem` | `AsyncStorage.getItem/setItem` |
| `window.location.href = '/login'` | `navigationRef.reset({ routes: [{ name: 'Login' }] })` |
| `<table>` sortable rows | `FlatList` with sort state + sort icon in header row |
| `<select>` dropdown | `@gorhom/bottom-sheet` + `FlatList` option list |
| Tailwind CSS classes | `StyleSheet.create` with `theme` constants |
| `motion.div` animations | `Animated.timing` / `Animated.spring` |
| `hover:` CSS states | `activeOpacity` on `TouchableOpacity` / `Pressable` |
| Web modals (`Dialog`) | `@gorhom/bottom-sheet` (full-screen on mobile) |
| Pagination buttons (prev/next) | `FlatList` `onEndReached` infinite scroll |
| Date `<input type="date">` | `react-native-date-picker` modal |
| Web kanban (drag-n-drop) | `react-native-draggable-flatlist` per column |
| Recharts charts | `react-native-gifted-charts` equivalents |
| xterm.js terminal | `ScrollView` + monospace `Text` + WebSocket |
| Next.js `<Link>` | `navigation.navigate()` |
| `useRouter().push('/dashboard')` | `navigation.navigate('Dashboard')` |
| `cn(...)` utility | Direct `StyleSheet` objects (no Tailwind merge) |
| `clsx` conditionals | Array spread: `[styles.base, active && styles.active]` |
| SSO `window.open(url)` | `InAppBrowser.openAuth(url, 'qcrm://auth/callback')` |
| `next/image` `<Image>` | `react-native` `Image` + `FastImage` for caching |

---

*End of Q-CRM Mobile Implementation Plan — 700+ lines, all phases complete.*
