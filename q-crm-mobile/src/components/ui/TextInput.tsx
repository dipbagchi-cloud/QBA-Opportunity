import React, {forwardRef} from 'react';
import {
  View,
  Text,
  TextInput as RNTextInput,
  TextInputProps as RNTextInputProps,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import {colors, spacing, borderRadius, typography} from '../../theme';

interface TextInputProps extends RNTextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
  required?: boolean;
}

export const TextInput = forwardRef<RNTextInput, TextInputProps>(
  (
    {label, error, hint, leftIcon, rightIcon, containerStyle, required, style, ...rest},
    ref,
  ) => {
    const hasError = !!error;

    return (
      <View style={[styles.container, containerStyle]}>
        {label ? (
          <Text style={styles.label}>
            {label}
            {required ? <Text style={styles.required}> *</Text> : null}
          </Text>
        ) : null}

        <View style={[styles.inputWrapper, hasError && styles.inputError]}>
          {leftIcon ? <View style={styles.leftIcon}>{leftIcon}</View> : null}

          <RNTextInput
            ref={ref}
            style={[
              styles.input,
              leftIcon ? styles.inputWithLeft : null,
              rightIcon ? styles.inputWithRight : null,
              style,
            ]}
            placeholderTextColor={colors.text.disabled}
            {...rest}
          />

          {rightIcon ? <View style={styles.rightIcon}>{rightIcon}</View> : null}
        </View>

        {hasError ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : hint ? (
          <Text style={styles.hintText}>{hint}</Text>
        ) : null}
      </View>
    );
  },
);

TextInput.displayName = 'TextInput';

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing[4],
  },
  label: {
    ...typography.label,
    color: colors.text.primary,
    marginBottom: spacing[1.5],
  },
  required: {
    color: colors.danger.DEFAULT,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    borderRadius: borderRadius.md,
    backgroundColor: colors.white,
    minHeight: 44,
  },
  inputError: {
    borderColor: colors.danger.DEFAULT,
  },
  input: {
    flex: 1,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2.5],
    ...typography.body,
    color: colors.text.primary,
  },
  inputWithLeft: {
    paddingLeft: spacing[1],
  },
  inputWithRight: {
    paddingRight: spacing[1],
  },
  leftIcon: {
    paddingLeft: spacing[3],
  },
  rightIcon: {
    paddingRight: spacing[3],
  },
  errorText: {
    ...typography.caption,
    color: colors.danger.DEFAULT,
    marginTop: spacing[1],
  },
  hintText: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: spacing[1],
  },
});
