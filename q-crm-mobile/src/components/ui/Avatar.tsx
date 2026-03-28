import React from 'react';
import {View, Text, Image, StyleSheet, ViewStyle} from 'react-native';
import {colors, borderRadius, typography} from '../../theme';
import {getInitials} from '../../lib/utils';

interface AvatarProps {
  name?: string;
  imageUri?: string;
  size?: number;
  style?: ViewStyle;
}

const BG_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
];

function pickColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return BG_COLORS[Math.abs(hash) % BG_COLORS.length];
}

export function Avatar({name = '', imageUri, size = 40, style}: AvatarProps) {
  const initials = getInitials(name);
  const bgColor = pickColor(name);
  const fontSize = Math.max(size * 0.38, 10);

  if (imageUri) {
    return (
      <Image
        source={{uri: imageUri}}
        style={[styles.image, {width: size, height: size, borderRadius: size / 2}, style]}
      />
    );
  }

  return (
    <View
      style={[
        styles.container,
        {width: size, height: size, borderRadius: size / 2, backgroundColor: bgColor},
        style,
      ]}>
      <Text style={[styles.initials, {fontSize}]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: colors.white,
    fontWeight: '600',
  },
  image: {
    resizeMode: 'cover',
  },
});
