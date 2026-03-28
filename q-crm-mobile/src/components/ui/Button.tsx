import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  TouchableOpacityProps,
} from 'react-native';
import {colors, spacing, borderRadius, typography} from '../../theme';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends TouchableOpacityProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  children: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  children,
  style,
  textStyle,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[
        styles.base,
        styles[variant],
        styles[`size_${size}`],
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
      disabled={isDisabled}
      activeOpacity={0.75}
      {...rest}>
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'outline' || variant === 'ghost' ? colors.primary.DEFAULT : colors.white}
        />
      ) : (
        <Text style={[styles.text, styles[`text_${variant}`], styles[`textSize_${size}`], textStyle]}>
          {children}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },

  // ── Variants ────────────────────────────────────────────────────
  primary: {
    backgroundColor: colors.primary.DEFAULT,
    borderColor: colors.primary.DEFAULT,
  },
  secondary: {
    backgroundColor: colors.gray[100],
    borderColor: colors.gray[200],
  },
  outline: {
    backgroundColor: colors.transparent,
    borderColor: colors.primary.DEFAULT,
  },
  danger: {
    backgroundColor: colors.danger.DEFAULT,
    borderColor: colors.danger.DEFAULT,
  },
  ghost: {
    backgroundColor: colors.transparent,
    borderColor: colors.transparent,
  },

  // ── Sizes ────────────────────────────────────────────────────────
  size_sm: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    minHeight: 32,
  },
  size_md: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2.5],
    minHeight: 44,
  },
  size_lg: {
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    minHeight: 52,
  },

  // ── Text ─────────────────────────────────────────────────────────
  text: {
    ...typography.button,
  },
  text_primary: {color: colors.white},
  text_secondary: {color: colors.text.primary},
  text_outline: {color: colors.primary.DEFAULT},
  text_danger: {color: colors.white},
  text_ghost: {color: colors.primary.DEFAULT},

  textSize_sm: {fontSize: typography.fontSize.sm},
  textSize_md: {fontSize: typography.fontSize.base},
  textSize_lg: {fontSize: typography.fontSize.lg},
});
