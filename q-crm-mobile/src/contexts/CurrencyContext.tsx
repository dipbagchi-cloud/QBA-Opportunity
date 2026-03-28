import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../lib/api';

type Currency = {
  code: string;
  symbol: string;
  rate: number; // rateToBase: 1 INR = X of this currency
};

const FALLBACK_CURRENCIES: Currency[] = [
  {code: 'INR', symbol: '₹', rate: 1},
  {code: 'USD', symbol: '$', rate: 0.012},
  {code: 'EUR', symbol: '€', rate: 0.011},
  {code: 'GBP', symbol: '£', rate: 0.0095},
  {code: 'SGD', symbol: 'S$', rate: 0.016},
  {code: 'AUD', symbol: 'A$', rate: 0.018},
];

type CurrencyContextValue = {
  currency: Currency;
  setCurrency: (code: string) => void;
  convert: (amountInBase: number) => number;
  format: (amountInBase: number) => string;
  formatCompact: (amountInBase: number) => string;
  availableCurrencies: Currency[];
  loaded: boolean;
};

const STORAGE_KEY = 'qcrm_currency';

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({children}: {children: ReactNode}) {
  const [currencies, setCurrencies] = useState<Currency[]>(FALLBACK_CURRENCIES);
  const [currency, setCurrencyState] = useState<Currency>(FALLBACK_CURRENCIES[0]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.get('/api/admin/currency-rates');
        if (Array.isArray(data) && data.length > 0) {
          const mapped: Currency[] = data
            .filter((r: any) => r.isActive)
            .map((r: any) => ({ code: r.code, symbol: r.symbol, rate: r.rateToBase || 1 }));
          if (mapped.length > 0) setCurrencies(mapped);

          const saved = await AsyncStorage.getItem(STORAGE_KEY);
          if (saved) {
            const found = mapped.find(c => c.code === saved);
            if (found) setCurrencyState(found);
          }
        }
      } catch {
        // Use fallback currencies
      } finally {
        // Load saved preference even with fallback
        try {
          const saved = await AsyncStorage.getItem(STORAGE_KEY);
          if (saved) {
            const found = currencies.find(c => c.code === saved);
            if (found) setCurrencyState(found);
          }
        } catch {}
        setLoaded(true);
      }
    })();
  }, []);

  const setCurrency = useCallback((code: string) => {
    setCurrencies(prev => {
      const found = prev.find(c => c.code === code);
      if (found) {
        setCurrencyState(found);
        AsyncStorage.setItem(STORAGE_KEY, code).catch(() => {});
      }
      return prev;
    });
  }, []);

  const convert = useCallback(
    (amountInBase: number) => {
      if (currency.code === 'INR') return amountInBase;
      return amountInBase * currency.rate;
    },
    [currency],
  );

  const format = useCallback(
    (amountInBase: number) => {
      const converted = convert(amountInBase);
      return `${currency.symbol}${converted.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })}`;
    },
    [convert, currency.symbol],
  );

  const formatCompact = useCallback(
    (amountInBase: number) => {
      const converted = convert(amountInBase);
      const abs = Math.abs(converted);
      const sym = currency.symbol;
      if (abs >= 1e7) return `${sym}${(converted / 1e7).toFixed(1)}Cr`;
      if (abs >= 1e5) return `${sym}${(converted / 1e5).toFixed(1)}L`;
      if (abs >= 1e6) return `${sym}${(converted / 1e6).toFixed(1)}M`;
      if (abs >= 1e3) return `${sym}${(converted / 1e3).toFixed(1)}K`;
      return `${sym}${converted.toFixed(0)}`;
    },
    [convert, currency.symbol],
  );

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        setCurrency,
        convert,
        format,
        formatCompact,
        availableCurrencies: currencies,
        loaded,
      }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    throw new Error('useCurrency must be used within CurrencyProvider');
  }
  return ctx;
}
