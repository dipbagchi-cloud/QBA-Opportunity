/**
 * Color palette — matches the web app's Tailwind/shadcn theme
 */
export const colors = {
  // ── Brand ──────────────────────────────────────────────────────────
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
    DEFAULT: '#2563eb',
  },

  // ── Neutral / Gray ────────────────────────────────────────────────
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },

  // ── Semantic ──────────────────────────────────────────────────────
  success: {
    light: '#d1fae5',
    DEFAULT: '#10b981',
    dark: '#065f46',
  },
  warning: {
    light: '#fef3c7',
    DEFAULT: '#f59e0b',
    dark: '#92400e',
  },
  danger: {
    light: '#fee2e2',
    DEFAULT: '#ef4444',
    dark: '#991b1b',
  },
  info: {
    light: '#dbeafe',
    DEFAULT: '#3b82f6',
    dark: '#1e40af',
  },

  // ── Stage Colors (Kanban) ─────────────────────────────────────────
  stage: {
    Lead: '#8b5cf6',
    Qualification: '#f59e0b',
    Proposal: '#3b82f6',
    Negotiation: '#f97316',
    'Closed Won': '#10b981',
    'Closed Lost': '#ef4444',
  },

  // ── GOM Threshold Colors ──────────────────────────────────────────
  gom: {
    good: '#10b981',    // >= 30%
    warning: '#f59e0b', // 15-30%
    danger: '#ef4444',  // < 15%
  },

  // ── Base ──────────────────────────────────────────────────────────
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',

  // ── Background ───────────────────────────────────────────────────
  background: {
    primary: '#ffffff',
    secondary: '#f9fafb',
    card: '#ffffff',
    overlay: 'rgba(0,0,0,0.5)',
  },

  // ── Text ─────────────────────────────────────────────────────────
  text: {
    primary: '#111827',
    secondary: '#6b7280',
    disabled: '#9ca3af',
    inverse: '#ffffff',
    link: '#2563eb',
  },

  // ── Border ───────────────────────────────────────────────────────
  border: {
    light: '#e5e7eb',
    DEFAULT: '#d1d5db',
    dark: '#9ca3af',
  },
} as const;

export type StageColor = keyof typeof colors.stage;
