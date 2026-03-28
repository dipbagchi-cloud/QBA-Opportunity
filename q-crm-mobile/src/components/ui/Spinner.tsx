import React from 'react';
import {ActivityIndicator, View, StyleSheet, Text, ViewStyle} from 'react-native';
import {colors, spacing, typography} from '../../theme';

interface SpinnerProps {
  size?: 'small' | 'large';
  color?: string;
  label?: string;
  fullScreen?: boolean;
  style?: ViewStyle;
}

export function Spinner({
  size = 'large',
  color = colors.primary.DEFAULT,
  label,
  fullScreen = false,
  style,
}: SpinnerProps) {
  if (fullScreen) {
    return (
      <View style={[styles.fullScreen, style]}>
        <ActivityIndicator size={size} color={color} />
        {label ? <Text style={styles.label}>{label}</Text> : null}
      </View>
    );
  }

  return (
    <View style={[styles.inline, style]}>
      <ActivityIndicator size={size} color={color} />
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.primary,
  },
  inline: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[4],
  },
  label: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginTop: spacing[2],
  },
});
