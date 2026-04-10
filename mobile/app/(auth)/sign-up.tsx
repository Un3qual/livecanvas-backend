import { useRouter } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useState } from 'react';

import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { AppHeader } from '../../src/components/AppHeader';
import { useAppleAuth } from '../../src/auth/useAppleAuth';
import { useGoogleAuth } from '../../src/auth/useGoogleAuth';
import { usePasswordAuth } from '../../src/auth/usePasswordAuth';
import { useAppTheme } from '../../src/providers/ThemeProvider';
import { radius, spacing, typography } from '../../src/theme/tokens';

type AuthFieldProps = {
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoComplete?:
    | 'email'
    | 'password'
    | 'username'
    | 'new-password'
    | 'current-password'
    | 'off';
  error?: string;
  keyboardType?: 'default' | 'email-address';
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  textContentType?: 'emailAddress' | 'password' | 'username' | 'newPassword';
  value: string;
};

function AuthField({
  autoCapitalize = 'none',
  autoComplete,
  error,
  keyboardType = 'default',
  label,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  textContentType,
  value,
}: AuthFieldProps) {
  const theme = useAppTheme();

  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>{label}</Text>
      <TextInput
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        secureTextEntry={secureTextEntry}
        style={[
          styles.input,
          {
            backgroundColor: theme.colors.surfaceMuted,
            borderColor: error ? theme.colors.error : theme.colors.border,
            color: theme.colors.text,
          },
        ]}
        textContentType={textContentType}
        value={value}
      />
      {error ? (
        <Text style={[styles.fieldError, { color: theme.colors.error }]}>{error}</Text>
      ) : null}
    </View>
  );
}

export default function SignUpScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const passwordAuth = usePasswordAuth();
  const googleAuth = useGoogleAuth();
  const appleAuth = useAppleAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');

  const formError =
    passwordAuth.formError ?? googleAuth.error ?? appleAuth.error;
  const isBusy =
    passwordAuth.isSubmitting ||
    googleAuth.isSubmitting ||
    appleAuth.isSubmitting;

  const clearTransientErrors = () => {
    passwordAuth.clearErrors();
    googleAuth.clearError();
    appleAuth.clearError();
  };

  const handlePasswordSignUp = async () => {
    if (isBusy) {
      return;
    }

    const success = await passwordAuth.signUpWithPassword({
      email,
      password,
      passwordConfirmation,
    });

    if (success) {
      router.replace('/home');
    }
  };

  const handleGoogleSignUp = async () => {
    if (isBusy) {
      return;
    }

    const success = await googleAuth.signUpWithGoogle();

    if (success) {
      router.replace('/home');
    }
  };

  const handleAppleSignUp = async () => {
    if (isBusy) {
      return;
    }

    const success = await appleAuth.signUpWithApple();

    if (success) {
      router.replace('/home');
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          style={styles.flex}
        >
          <AppCard>
            <AppHeader
              eyebrow="Account setup"
              subtitle="Create a LiveCanvas account with password or a supported provider."
              title="Sign up"
            />

            <View style={styles.form}>
              <AuthField
                autoComplete="email"
                error={passwordAuth.fieldErrors.email}
                keyboardType="email-address"
                label="Email"
                onChangeText={(value) => {
                  clearTransientErrors();
                  setEmail(value);
                }}
                placeholder="you@example.com"
                textContentType="emailAddress"
                value={email}
              />

              <AuthField
                autoComplete="new-password"
                error={passwordAuth.fieldErrors.password}
                label="Password"
                onChangeText={(value) => {
                  clearTransientErrors();
                  setPassword(value);
                }}
                placeholder="Choose a password"
                secureTextEntry
                textContentType="newPassword"
                value={password}
              />

              <AuthField
                autoComplete="new-password"
                error={passwordAuth.fieldErrors.passwordConfirmation}
                label="Confirm password"
                onChangeText={(value) => {
                  clearTransientErrors();
                  setPasswordConfirmation(value);
                }}
                placeholder="Re-enter your password"
                secureTextEntry
                textContentType="newPassword"
                value={passwordConfirmation}
              />

              {formError ? (
                <View
                  style={[
                    styles.errorBanner,
                    {
                      backgroundColor: theme.colors.errorMuted,
                      borderColor: theme.colors.error,
                    },
                  ]}
                >
                  <Text style={[styles.errorText, { color: theme.colors.error }]}>
                    {formError}
                  </Text>
                </View>
              ) : null}

              <AppButton
                label={
                  passwordAuth.isSubmitting ? 'Creating account...' : 'Create account'
                }
                onPress={handlePasswordSignUp}
              />

              <View style={styles.dividerRow}>
                <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
                <Text style={[styles.dividerLabel, { color: theme.colors.textMuted }]}>
                  or continue with
                </Text>
                <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
              </View>

              <AppButton
                label={
                  googleAuth.isSubmitting ? 'Opening Google...' : 'Continue with Google'
                }
                onPress={handleGoogleSignUp}
                variant="secondary"
              />

              {appleAuth.isAvailable ? (
                <AppButton
                  label={
                    appleAuth.isSubmitting ? 'Opening Apple...' : 'Continue with Apple'
                  }
                  onPress={handleAppleSignUp}
                  variant="secondary"
                />
              ) : null}
            </View>

            <View style={styles.footerRow}>
              <Text style={[styles.footerText, { color: theme.colors.textMuted }]}>
                Already have an account?
              </Text>
              <Pressable onPress={() => router.replace('/sign-in')}>
                <Text style={[styles.footerAction, { color: theme.colors.accent }]}>
                  Sign in
                </Text>
              </Pressable>
            </View>
          </AppCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  form: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
  fieldGroup: {
    gap: spacing.xs,
  },
  fieldLabel: {
    ...typography.label,
  },
  input: {
    borderRadius: radius.md,
    borderWidth: 1,
    fontSize: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  fieldError: {
    fontSize: 13,
    lineHeight: 18,
  },
  errorBanner: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
  },
  dividerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  footerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  footerText: {
    fontSize: 14,
  },
  footerAction: {
    fontSize: 14,
    fontWeight: '700',
  },
});
