import React, {useEffect, useRef} from 'react';
import {Animated, View, StyleSheet, ViewStyle} from 'react-native';
import {colors, borderRadius, spacing} from '../../theme';

interface SkeletonBarProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

function SkeletonBar({
  width = '100%',
  height = 16,
  borderRadius: br = borderRadius.sm,
  style,
}: SkeletonBarProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {toValue: 1, duration: 700, useNativeDriver: true}),
        Animated.timing(opacity, {toValue: 0.3, duration: 700, useNativeDriver: true}),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {width: width as any, height, borderRadius: br, backgroundColor: colors.gray[200], opacity},
        style,
      ]}
    />
  );
}

/** Skeleton card for lists */
export function SkeletonCard({style}: {style?: ViewStyle}) {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.row}>
        <SkeletonBar width={32} height={32} borderRadius={16} />
        <View style={styles.colFlex}>
          <SkeletonBar height={14} width="60%" />
          <SkeletonBar height={12} width="40%" style={styles.mt} />
        </View>
      </View>
      <SkeletonBar height={12} style={styles.mt2} />
      <SkeletonBar height={12} width="80%" style={styles.mt} />
    </View>
  );
}

export function SkeletonListItem({style}: {style?: ViewStyle}) {
  return (
    <View style={[styles.listItem, style]}>
      <SkeletonBar width={36} height={36} borderRadius={18} />
      <View style={styles.colFlex}>
        <SkeletonBar height={14} width="55%" />
        <SkeletonBar height={12} width="35%" style={styles.mt} />
      </View>
      <SkeletonBar width={60} height={20} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    marginBottom: spacing[3],
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  colFlex: {
    flex: 1,
  },
  mt: {
    marginTop: spacing[1.5],
  },
  mt2: {
    marginTop: spacing[3],
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
});
