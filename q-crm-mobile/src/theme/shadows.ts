import {Platform, ViewStyle} from 'react-native';
import {colors} from './colors';

/**
 * Cross-platform shadow styles
 */

function androidElevation(level: number): ViewStyle {
  return {elevation: level};
}

function iosShadow(
  opacity: number,
  radius: number,
  offsetY: number,
): ViewStyle {
  return {
    shadowColor: colors.black,
    shadowOpacity: opacity,
    shadowRadius: radius,
    shadowOffset: {width: 0, height: offsetY},
  };
}

function shadow(
  opacity: number,
  radius: number,
  offsetY: number,
  elevation: number,
): ViewStyle {
  return Platform.OS === 'android'
    ? androidElevation(elevation)
    : iosShadow(opacity, radius, offsetY);
}

export const shadows = {
  none: {} as ViewStyle,
  xs: shadow(0.05, 2, 1, 1),
  sm: shadow(0.07, 3, 2, 2),
  md: shadow(0.1, 6, 3, 4),
  lg: shadow(0.12, 10, 5, 6),
  xl: shadow(0.15, 16, 8, 10),
  '2xl': shadow(0.2, 24, 12, 16),
} as const;
