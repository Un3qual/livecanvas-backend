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

export default function SignInScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const passwordAuth = usePasswordAuth();
  const googleAuth = useGoogleAuth();
  const appleAuth = useAppleAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  const handlePasswordSignIn = async () => {
    const success = await actionLockRef.current.run(async () => {
      if (isBusy) {
        return false;
      }

      clearTransientErrors();

      return passwordAuth.signInWithPassword({
        email,
        password,
      });
    });

    if (success) {
      router.replace('/home');
    }
  };

  const handleGoogleSignIn = async () => {
    const success = await actionLockRef.current.run(async () => {
      if (isBusy) {
        return false;
      }

      clearTransientErrors();

      return googleAuth.signInWithGoogle();
    });

    if (success) {
      router.replace('/home');
    }
  };

  const handleAppleSignIn = async () => {
    const success = await actionLockRef.current.run(async () => {
      if (isBusy) {
        return false;
      }

      clearTransientErrors();

      return appleAuth.signInWithApple();
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
              eyebrow="Relay auth"
              subtitle="Use your LiveCanvas password or continue with a linked provider."
              title="Sign in"
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
                autoComplete="current-password"
                error={passwordAuth.fieldErrors.password}
                label="Password"
                onChangeText={(value) => {
                  clearTransientErrors();
                  setPassword(value);
                }}
                placeholder="Enter your password"
                secureTextEntry
                textContentType="password"
                value={password}
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
                  passwordAuth.isSubmitting ? 'Signing in...' : 'Sign in'
                }
                disabled={isBusy}
                onPress={handlePasswordSignIn}
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
                  onPress={handleGoogleSignIn}
                  variant="secondary"
                />
              ) : null}

              {appleAuth.isAvailable ? (
                <AppButton
                  disabled={isBusy}
                  label={
                    appleAuth.isSubmitting ? 'Opening Apple...' : 'Continue with Apple'
                  }
                  onPress={handleAppleSignIn}
                  variant="secondary"
                />
              ) : null}
            </View>

            <View style={styles.footerRow}>
              <Text style={[styles.footerText, { color: theme.colors.textMuted }]}>
                Need an account?
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

                  router.replace('/sign-up');
                }}
              >
                <Text style={[styles.footerAction, { color: theme.colors.accent }]}>
                  Sign up
                </Text>
              </Pressable>
            </View>
          </AppCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
