import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { AppButton } from '../../components/AppButton';
import { AppCard } from '../../components/AppCard';
import { AppHeader } from '../../components/AppHeader';
import { AuthField } from '../../components/AuthField';
import {
  authRouteHref,
  readAuthReturnToParam,
} from '../../config/runtime';
import { useAppTheme } from '../../providers/ThemeProvider';
import type { AuthEntryMode } from '../authEntryControllerReducer';
import { useAuthEntryController } from '../useAuthEntryController';
import { authScreenStyles as styles } from './authEntryScreenStyles';

type AuthEntryScreenProps = {
  mode: AuthEntryMode;
};

type AuthEntryCopy = {
  alternateHref: '/sign-in' | '/sign-up';
  alternateLabel: string;
  eyebrow: string;
  footerPrompt: string;
  passwordAutoComplete: 'current-password' | 'new-password';
  passwordPlaceholder: string;
  passwordTextContentType: 'password' | 'newPassword';
  primaryBusyLabel: string;
  primaryLabel: string;
  subtitle: string;
  title: string;
};

const AUTH_ENTRY_COPY: Record<AuthEntryMode, AuthEntryCopy> = {
  signIn: {
    alternateHref: '/sign-up',
    alternateLabel: 'Sign up',
    eyebrow: 'Relay auth',
    footerPrompt: 'Need an account?',
    passwordAutoComplete: 'current-password',
    passwordPlaceholder: 'Enter your password',
    passwordTextContentType: 'password',
    primaryBusyLabel: 'Signing in...',
    primaryLabel: 'Sign in',
    subtitle:
      'Use your LiveCanvas password or continue with a linked provider.',
    title: 'Sign in',
  },
  signUp: {
    alternateHref: '/sign-in',
    alternateLabel: 'Sign in',
    eyebrow: 'Account setup',
    footerPrompt: 'Already have an account?',
    passwordAutoComplete: 'new-password',
    passwordPlaceholder: 'Choose a password',
    passwordTextContentType: 'newPassword',
    primaryBusyLabel: 'Creating account...',
    primaryLabel: 'Create account',
    subtitle:
      'Create a LiveCanvas account with password or a supported provider.',
    title: 'Sign up',
  },
};

export function AuthEntryScreen({ mode }: AuthEntryScreenProps) {
  const router = useRouter();
  const { returnTo: rawReturnTo } = useLocalSearchParams<{
    returnTo?: string | string[];
  }>();
  const theme = useAppTheme();
  const controller = useAuthEntryController(mode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const copy = AUTH_ENTRY_COPY[mode];
  const returnToHref = readAuthReturnToParam(rawReturnTo);
  const successHref = returnToHref ?? '/home';

  const handlePasswordSubmit = async () => {
    const success = await controller.submitPassword({
      email,
      password,
      passwordConfirmation,
    });

    if (success) {
      router.replace(successHref);
    }
  };

  const handleGoogleSubmit = async () => {
    const success = await controller.submitGoogle();

    if (success) {
      router.replace(successHref);
    }
  };

  const handleAppleSubmit = async () => {
    const success = await controller.submitApple();

    if (success) {
      router.replace(successHref);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          style={styles.flex}
        >
          <AppCard>
            <AppHeader
              eyebrow={copy.eyebrow}
              subtitle={copy.subtitle}
              title={copy.title}
            />

            <View style={styles.form}>
              <AuthField
                autoComplete="email"
                error={controller.fieldErrors.email}
                keyboardType="email-address"
                label="Email"
                onChangeText={(value) => {
                  controller.clearTransientErrors();
                  setEmail(value);
                }}
                placeholder="you@example.com"
                textContentType="emailAddress"
                value={email}
              />

              <AuthField
                autoComplete={copy.passwordAutoComplete}
                error={controller.fieldErrors.password}
                label="Password"
                onChangeText={(value) => {
                  controller.clearTransientErrors();
                  setPassword(value);
                }}
                placeholder={copy.passwordPlaceholder}
                secureTextEntry
                textContentType={copy.passwordTextContentType}
                value={password}
              />

              {mode === 'signUp' ? (
                <AuthField
                  autoComplete="new-password"
                  error={controller.fieldErrors.passwordConfirmation}
                  label="Confirm password"
                  onChangeText={(value) => {
                    controller.clearTransientErrors();
                    setPasswordConfirmation(value);
                  }}
                  placeholder="Re-enter your password"
                  secureTextEntry
                  textContentType="newPassword"
                  value={passwordConfirmation}
                />
              ) : null}

              {controller.formError ? (
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
                    {controller.formError}
                  </Text>
                </View>
              ) : null}

              <AppButton
                disabled={controller.isBusy}
                label={
                  controller.isPasswordSubmitting
                    ? copy.primaryBusyLabel
                    : copy.primaryLabel
                }
                onPress={handlePasswordSubmit}
              />

              {controller.showOauthDivider ? (
                <View style={styles.dividerRow}>
                  <View
                    style={[
                      styles.dividerLine,
                      { backgroundColor: theme.colors.border },
                    ]}
                  />
                  <Text
                    style={[
                      styles.dividerLabel,
                      { color: theme.colors.textMuted },
                    ]}
                  >
                    or continue with
                  </Text>
                  <View
                    style={[
                      styles.dividerLine,
                      { backgroundColor: theme.colors.border },
                    ]}
                  />
                </View>
              ) : null}

              {controller.hasGoogleAuthOption ? (
                <AppButton
                  disabled={controller.isBusy}
                  label={
                    controller.isGoogleSubmitting
                      ? 'Opening Google...'
                      : 'Continue with Google'
                  }
                  onPress={handleGoogleSubmit}
                  variant="secondary"
                />
              ) : null}

              {controller.hasAppleAuthOption ? (
                <AppButton
                  disabled={controller.isBusy}
                  label={
                    controller.isAppleSubmitting
                      ? 'Opening Apple...'
                      : 'Continue with Apple'
                  }
                  onPress={handleAppleSubmit}
                  variant="secondary"
                />
              ) : null}
            </View>

            <View style={styles.footerRow}>
              <Text
                style={[styles.footerText, { color: theme.colors.textMuted }]}
              >
                {copy.footerPrompt}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: !controller.canSwitchScreens }}
                disabled={!controller.canSwitchScreens}
                hitSlop={8}
                onPress={() => {
                  controller.handleAlternateScreenPress(() => {
                    router.replace(authRouteHref(copy.alternateHref, returnToHref));
                  });
                }}
              >
                <Text
                  style={[styles.footerAction, { color: theme.colors.accent }]}
                >
                  {copy.alternateLabel}
                </Text>
              </Pressable>
            </View>
          </AppCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
