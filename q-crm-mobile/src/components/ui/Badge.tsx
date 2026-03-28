import React from 'react';
import {View, Text, StyleSheet, ViewStyle} from 'react-native';
import {colors, spacing, borderRadius, typography} from '../../theme';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
  size?: 'sm' | 'md';
}

const variantStyles: Record<BadgeVariant, {bg: string; text: string; border: string}> = {
  default: {bg: colors.gray[100], text: colors.gray[700], border: colors.gray[200]},
  success: {bg: colors.success.light, text: colors.success.dark, border: colors.success.DEFAULT},
  warning: {bg: colors.warning.light, text: colors.warning.dark, border: colors.warning.DEFAULT},
  danger: {bg: colors.danger.light, text: colors.danger.dark, border: colors.danger.DEFAULT},
  info: {bg: colors.info.light, text: colors.info.dark, border: colors.info.DEFAULT},
  purple: {bg: '#ede9fe', text: '#5b21b6', border: '#8b5cf6'},
};

export function Badge({label, variant = 'default', style, size = 'sm'}: BadgeProps) {
  const vs = variantStyles[variant];
  return (
    <View
      style={[
        styles.base,
        size === 'md' ? styles.sizeMd : styles.sizeSm,
        {backgroundColor: vs.bg, borderColor: vs.border},
        style,
      ]}>
      <Text style={[styles.text, size === 'md' ? styles.textMd : styles.textSm, {color: vs.text}]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: borderRadius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  sizeSm: {paddingHorizontal: spacing[2], paddingVertical: 2},
  sizeMd: {paddingHorizontal: spacing[3], paddingVertical: spacing[1]},
  text: {},
  textSm: {...typography.caption, fontWeight: '600'},
  textMd: {...typography.bodySmall, fontWeight: '600'},
});
