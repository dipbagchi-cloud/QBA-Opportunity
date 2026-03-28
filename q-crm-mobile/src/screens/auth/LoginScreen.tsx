import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
} from 'react-native';
import {useForm, Controller} from 'react-hook-form';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useAuthStore} from '../../lib/auth-store';
import {Button} from '../../components/ui/Button';
import {TextInput} from '../../components/ui/TextInput';
import {Toast} from '../../components/ui/Toast';
import {colors, spacing, typography, borderRadius, shadows} from '../../theme';
import type {LoginScreenProps} from '../../navigation/types';
import {API_URL} from '../../lib/api';

interface LoginForm {
  email: string;
  password: string;
}

export function LoginScreen({navigation}: LoginScreenProps) {
  const {login, isLoading, error, clearError} = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const {
    control,
    handleSubmit,
    formState: {errors},
  } = useForm<LoginForm>({
    defaultValues: {email: '', password: ''},
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
  };

  const onSubmit = async (data: LoginForm) => {
    clearError();
    const success = await login(data.email.trim().toLowerCase(), data.password);
    if (!success) {
      showToast(error || 'Login failed. Please check your credentials.');
    }
    // On success, AppNavigator will automatically switch to MainNavigator
  };

  const handleSSOLogin = async () => {
    setSsoLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/sso/url`);
      if (!res.ok) {
        showToast('Microsoft SSO is not configured on the server.');
        return;
      }
      const {url} = await res.json();
      if (url) {
        // Open Microsoft login in external browser; deep-link callback handled via app scheme
        await Linking.openURL(url);
      }
    } catch {
      showToast('Could not initiate SSO. Check your network connection.');
    } finally {
      setSsoLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          {/* Logo + Brand */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoText}>Q</Text>
            </View>
            <Text style={styles.brandName}>Q‑CRM</Text>
            <Text style={styles.tagline}>Sales Intelligence Platform</Text>
          </View>

          {/* Login Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sign In</Text>
            <Text style={styles.cardSubtitle}>
              Enter your credentials to access your account
            </Text>

            {/* Email */}
            <Controller
              control={control}
              name="email"
              rules={{
                required: 'Email is required',
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: 'Enter a valid email address',
                },
              }}
              render={({field: {onChange, onBlur, value}}) => (
                <TextInput
                  label="Email Address"
                  placeholder="you@company.com"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.email?.message}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  returnKeyType="next"
                  required
                />
              )}
            />

            {/* Password */}
            <Controller
              control={control}
              name="password"
              rules={{required: 'Password is required', minLength: {value: 1, message: 'Enter your password'}}}
              render={({field: {onChange, onBlur, value}}) => (
                <TextInput
                  label="Password"
                  placeholder="Enter your password"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.password?.message}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit(onSubmit)}
                  required
                  rightIcon={
                    <TouchableOpacity
                      onPress={() => setShowPassword(p => !p)}
                      hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                      <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁'}</Text>
                    </TouchableOpacity>
                  }
                />
              )}
            />

            {/* Sign In Button */}
            <Button
              variant="primary"
              size="lg"
              fullWidth
              loading={isLoading}
              onPress={handleSubmit(onSubmit)}
              style={styles.signInBtn}>
              Sign In
            </Button>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Microsoft SSO */}
            <Button
              variant="outline"
              size="lg"
              fullWidth
              loading={ssoLoading}
              onPress={handleSSOLogin}
              style={styles.ssoBtn}>
              🪟  Microsoft SSO
            </Button>
          </View>

          {/* Footer */}
          <Text style={styles.footer}>
            Powered by Qbalux · Q‑CRM v1.0
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      <Toast
        visible={toastVisible}
        message={toastMessage}
        type="error"
        onClose={() => setToastVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  flex: {flex: 1},
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing[5],
  },

  // ── Header ────────────────────────────────────────────────────
  header: {
    alignItems: 'center',
    marginBottom: spacing[8],
  },
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: colors.primary.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
    ...shadows.md,
  },
  logoText: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.white,
  },
  brandName: {
    ...typography.h2,
    color: colors.text.primary,
  },
  tagline: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing[1],
  },

  // ── Card ─────────────────────────────────────────────────────
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing[6],
    ...shadows.md,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  cardTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing[1],
  },
  cardSubtitle: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginBottom: spacing[5],
  },

  signInBtn: {
    marginTop: spacing[2],
  },

  // ── Divider ──────────────────────────────────────────────────
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing[4],
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border.light,
  },
  dividerText: {
    ...typography.caption,
    color: colors.text.secondary,
    marginHorizontal: spacing[3],
  },

  ssoBtn: {marginBottom: spacing[1]},

  eyeIcon: {fontSize: 18},

  // ── Footer ───────────────────────────────────────────────────
  footer: {
    ...typography.caption,
    color: colors.text.disabled,
    textAlign: 'center',
    marginTop: spacing[6],
  },
});
