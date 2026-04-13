import { useRouter } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useRef, useState } from 'react';

import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { AuthField } from '../../src/components/AuthField';
import { AppHeader } from '../../src/components/AppHeader';
import { authScreenStyles as styles } from '../../src/components/authScreenStyles';
import { createAuthActionLock } from '../../src/auth/authActionLock';
import { resolveAuthEntryUiState } from '../../src/auth/authEntryUiState';
import { useAppleAuth } from '../../src/auth/useAppleAuth';
import { useGoogleAuth } from '../../src/auth/useGoogleAuth';
import { usePasswordAuth } from '../../src/auth/usePasswordAuth';
import { useAppTheme } from '../../src/providers/ThemeProvider';

export default function SignUpScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const passwordAuth = usePasswordAuth();
  const googleAuth = useGoogleAuth();
  const appleAuth = useAppleAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  // Hook-level guards only cover one provider at a time; this lock blocks cross-provider
  // taps and route switches until the active auth attempt settles.
  const actionLockRef = useRef(createAuthActionLock());

  const formError =
    passwordAuth.formError ?? googleAuth.error ?? appleAuth.error;
  const isBusy =
    passwordAuth.isSubmitting ||
    googleAuth.isSubmitting ||
    appleAuth.isSubmitting;
  const uiState = resolveAuthEntryUiState({
    hasAppleAuthOption: appleAuth.isAvailable,
    hasGoogleAuthOption: googleAuth.isSupported,
    isBusy,
  });

  const clearTransientErrors = () => {
    passwordAuth.clearErrors();
    googleAuth.clearError();
    appleAuth.clearError();
  };

  const handlePasswordSignUp = async () => {
    const success = await actionLockRef.current.run(async () => {
      if (isBusy) {
        return false;
      }

      clearTransientErrors();

      return passwordAuth.signUpWithPassword({
        email,
        password,
        passwordConfirmation,
      });
    });

    if (success) {
      router.replace('/home');
    }
  };

  const handleGoogleSignUp = async () => {
    const success = await actionLockRef.current.run(async () => {
      if (isBusy) {
        return false;
      }

      clearTransientErrors();

      return googleAuth.signUpWithGoogle();
    });

    if (success) {
      router.replace('/home');
    }
  };

  const handleAppleSignUp = async () => {
    const success = await actionLockRef.current.run(async () => {
      if (isBusy) {
        return false;
      }

      clearTransientErrors();

      return appleAuth.signUpWithApple();
    });

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
                disabled={isBusy}
                onPress={handlePasswordSignUp}
              />

              {uiState.showOauthDivider ? (
                <View style={styles.dividerRow}>
                  <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
                  <Text style={[styles.dividerLabel, { color: theme.colors.textMuted }]}>
                    or continue with
                  </Text>
                  <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
                </View>
              ) : null}

              {googleAuth.isSupported ? (
                <AppButton
                  disabled={isBusy}
                  label={
                    googleAuth.isSubmitting ? 'Opening Google...' : 'Continue with Google'
                  }
                  onPress={handleGoogleSignUp}
                  variant="secondary"
                />
              ) : null}

              {appleAuth.isAvailable ? (
                <AppButton
                  disabled={isBusy}
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
              <Pressable
                disabled={!uiState.canSwitchScreens}
                onPress={() => {
                  if (
                    !uiState.canSwitchScreens ||
                    actionLockRef.current.isLocked()
                  ) {
                    return;
                  }

                  router.replace('/sign-in');
                }}
              >
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
