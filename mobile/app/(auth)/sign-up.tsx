import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useState } from 'react';

import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { AuthField } from '../../src/components/AuthField';
import { AppHeader } from '../../src/components/AppHeader';
import { authScreenStyles as styles } from '../../src/components/authScreenStyles';
import { useAuthEntryController } from '../../src/auth/useAuthEntryController';
import {
  authRouteHref,
  readAuthReturnToParam,
} from '../../src/config/runtime';
import { useAppTheme } from '../../src/providers/ThemeProvider';

export default function SignUpScreen() {
  const router = useRouter();
  const { returnTo: rawReturnTo } = useLocalSearchParams<{
    returnTo?: string | string[];
  }>();
  const theme = useAppTheme();
  const controller = useAuthEntryController('signUp');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const returnToHref = readAuthReturnToParam(rawReturnTo);
  const successHref = returnToHref ?? '/home';

  const handlePasswordSignUp = async () => {
    const success = await controller.submitPassword({
      email,
      password,
      passwordConfirmation,
    });

    if (success) {
      router.replace(successHref);
    }
  };

  const handleGoogleSignUp = async () => {
    const success = await controller.submitGoogle();

    if (success) {
      router.replace(successHref);
    }
  };

  const handleAppleSignUp = async () => {
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
                autoComplete="new-password"
                error={controller.fieldErrors.password}
                label="Password"
                onChangeText={(value) => {
                  controller.clearTransientErrors();
                  setPassword(value);
                }}
                placeholder="Choose a password"
                secureTextEntry
                textContentType="newPassword"
                value={password}
              />

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
                label={
                  controller.isPasswordSubmitting ? 'Creating account...' : 'Create account'
                }
                disabled={controller.isBusy}
                onPress={handlePasswordSignUp}
              />

              {controller.showOauthDivider ? (
                <View style={styles.dividerRow}>
                  <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
                  <Text style={[styles.dividerLabel, { color: theme.colors.textMuted }]}>
                    or continue with
                  </Text>
                  <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
                </View>
              ) : null}

              {controller.hasGoogleAuthOption ? (
                <AppButton
                  disabled={controller.isBusy}
                  label={
                    controller.isGoogleSubmitting ? 'Opening Google...' : 'Continue with Google'
                  }
                  onPress={handleGoogleSignUp}
                  variant="secondary"
                />
              ) : null}

              {controller.hasAppleAuthOption ? (
                <AppButton
                  disabled={controller.isBusy}
                  label={
                    controller.isAppleSubmitting ? 'Opening Apple...' : 'Continue with Apple'
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
                disabled={!controller.canSwitchScreens}
                onPress={() => {
                  controller.handleAlternateScreenPress(() => {
                    router.replace(authRouteHref('/sign-in', returnToHref));
                  });
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
