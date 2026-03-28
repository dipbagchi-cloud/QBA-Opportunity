import React, {useEffect, useRef} from 'react';
import {
  Animated,
  Text,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {colors, spacing, borderRadius, typography, shadows} from '../../theme';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose?: () => void;
  visible: boolean;
}

const typeConfig: Record<ToastType, {bg: string; icon: string}> = {
  success: {bg: colors.success.DEFAULT, icon: '✓'},
  error: {bg: colors.danger.DEFAULT, icon: '✕'},
  warning: {bg: colors.warning.DEFAULT, icon: '⚠'},
  info: {bg: colors.primary.DEFAULT, icon: 'ℹ'},
};

export function Toast({
  message,
  type = 'info',
  duration = 3000,
  onClose,
  visible,
}: ToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, {toValue: 1, duration: 200, useNativeDriver: true}),
        Animated.timing(translateY, {toValue: 0, duration: 200, useNativeDriver: true}),
      ]).start();

      const timer = setTimeout(() => {
        dismiss();
      }, duration);

      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(opacity, {toValue: 0, duration: 200, useNativeDriver: true}),
      Animated.timing(translateY, {toValue: -20, duration: 200, useNativeDriver: true}),
    ]).start(() => onClose?.());
  };

  if (!visible) {
    return null;
  }

  const config = typeConfig[type];

  return (
    <Animated.View
      style={[
        styles.container,
        {backgroundColor: config.bg},
        {opacity, transform: [{translateY}]},
        shadows.lg,
      ]}>
      <Text style={styles.icon}>{config.icon}</Text>
      <Text style={styles.message} numberOfLines={3}>
        {message}
      </Text>
      <TouchableOpacity onPress={dismiss} hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
        <View style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: spacing[4],
    right: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[3],
    borderRadius: borderRadius.lg,
    zIndex: 9999,
  },
  icon: {
    color: colors.white,
    fontSize: 16,
    marginRight: spacing[2],
    fontWeight: 'bold',
  },
  message: {
    ...typography.bodySmall,
    color: colors.white,
    flex: 1,
  },
  closeBtn: {
    marginLeft: spacing[2],
  },
  closeText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '600',
  },
});
