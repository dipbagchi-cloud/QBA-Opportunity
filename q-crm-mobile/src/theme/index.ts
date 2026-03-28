/**
 * Combined theme export + React Native Paper theme configuration
 */
import {MD3LightTheme, configureFonts} from 'react-native-paper';
import {colors} from './colors';
import {typography} from './typography';
import {spacing, borderRadius} from './spacing';
import {shadows} from './shadows';

export {colors, typography, spacing, borderRadius, shadows};

// Map our color palette to React Native Paper's MD3 theme
const paperTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.primary.DEFAULT,
    onPrimary: colors.white,
    primaryContainer: colors.primary[100],
    onPrimaryContainer: colors.primary[900],
    secondary: colors.gray[600],
    onSecondary: colors.white,
    secondaryContainer: colors.gray[100],
    onSecondaryContainer: colors.gray[900],
    error: colors.danger.DEFAULT,
    onError: colors.white,
    errorContainer: colors.danger.light,
    onErrorContainer: colors.danger.dark,
    background: colors.background.primary,
    onBackground: colors.text.primary,
    surface: colors.background.card,
    onSurface: colors.text.primary,
    surfaceVariant: colors.gray[100],
    onSurfaceVariant: colors.gray[600],
    outline: colors.border.DEFAULT,
    outlineVariant: colors.border.light,
  },
  fonts: configureFonts({config: {}}),
};

export const theme = paperTheme;
export type AppTheme = typeof paperTheme;
