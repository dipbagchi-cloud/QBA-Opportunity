/**
 * Custom render helper for React Native tests.
 * Wraps all providers required by the app.
 */
import React, {ReactElement, ReactNode} from 'react';
import {render, RenderOptions} from '@testing-library/react-native';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {NavigationContainer} from '@react-navigation/native';
import {Provider as PaperProvider} from 'react-native-paper';
import {CurrencyProvider} from '../../contexts/CurrencyContext';

// ─── QueryClient factory (no retries, instant failures) ──────────────────────

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
    logger: {
      log: () => {},
      warn: () => {},
      error: () => {},
    },
  });
}

// ─── All-providers wrapper ────────────────────────────────────────────────────

interface WrapperProps {
  children: ReactNode;
  queryClient?: QueryClient;
}

export function AllProviders({children, queryClient}: WrapperProps) {
  const client = queryClient ?? createTestQueryClient();
  return (
    <QueryClientProvider client={client}>
      <PaperProvider>
        <CurrencyProvider>
          {children}
        </CurrencyProvider>
      </PaperProvider>
    </QueryClientProvider>
  );
}

/** Wrapper that also wraps in NavigationContainer (needed for screens). */
export function AllProvidersWithNav({children, queryClient}: WrapperProps) {
  const client = queryClient ?? createTestQueryClient();
  return (
    <NavigationContainer>
      <QueryClientProvider client={client}>
        <PaperProvider>
          <CurrencyProvider>
            {children}
          </CurrencyProvider>
        </PaperProvider>
      </QueryClientProvider>
    </NavigationContainer>
  );
}

// ─── renderWithProviders ──────────────────────────────────────────────────────

interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient;
  withNavigation?: boolean;
}

export function renderWithProviders(
  ui: ReactElement,
  {queryClient, withNavigation = false, ...renderOptions}: RenderWithProvidersOptions = {},
) {
  const Wrapper = withNavigation ? AllProvidersWithNav : AllProviders;
  const wrapperProps = {queryClient};

  return render(ui, {
    wrapper: ({children}) => (
      <Wrapper {...wrapperProps}>{children}</Wrapper>
    ),
    ...renderOptions,
  });
}

// Re-export everything from RNTL for convenience
export * from '@testing-library/react-native';
