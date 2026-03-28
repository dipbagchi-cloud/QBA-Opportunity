import React from 'react';
import {View, StyleSheet, ViewStyle} from 'react-native';
import {colors, spacing, borderRadius, shadows} from '../../theme';

type PaddingVariant = 'none' | 'sm' | 'md' | 'lg';

interface CardProps {
  children: React.ReactNode;
  padding?: PaddingVariant;
  shadow?: keyof typeof shadows;
  style?: ViewStyle;
}

export function Card({
  children,
  padding = 'md',
  shadow: shadowLevel = 'sm',
  style,
}: CardProps) {
  return (
    <View
      style={[
        styles.card,
        styles[`padding_${padding}`],
        shadows[shadowLevel],
        style,
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  padding_none: {
    padding: 0,
  },
  padding_sm: {
    padding: spacing[3],
  },
  padding_md: {
    padding: spacing[4],
  },
  padding_lg: {
    padding: spacing[6],
  },
});
