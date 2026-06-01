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

export default function SignInScreen() {
  const router = useRouter();
  const { returnTo: rawReturnTo } = useLocalSearchParams<{
    returnTo?: string | string[];
  }>();
  const theme = useAppTheme();
  const controller = useAuthEntryController('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const returnToHref = readAuthReturnToParam(rawReturnTo);
  const successHref = returnToHref ?? '/home';

  const handlePasswordSignIn = async () => {
    const success = await controller.submitPassword({
      email,
      password,
    });

    if (success) {
      router.replace(successHref);
    }
  };

  const handleGoogleSignIn = async () => {
    const success = await controller.submitGoogle();

    if (success) {
      router.replace(successHref);
    }
  };

  const handleAppleSignIn = async () => {
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
              eyebrow="Relay auth"
              subtitle="Use your LiveCanvas password or continue with a linked provider."
              title="Sign in"
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
                autoComplete="current-password"
                error={controller.fieldErrors.password}
                label="Password"
                onChangeText={(value) => {
                  controller.clearTransientErrors();
                  setPassword(value);
                }}
                placeholder="Enter your password"
                secureTextEntry
                textContentType="password"
                value={password}
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
                  controller.isPasswordSubmitting ? 'Signing in...' : 'Sign in'
                }
                disabled={controller.isBusy}
                onPress={handlePasswordSignIn}
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
                  onPress={handleGoogleSignIn}
                  variant="secondary"
                />
              ) : null}

              {controller.hasAppleAuthOption ? (
                <AppButton
                  disabled={controller.isBusy}
                  label={
                    controller.isAppleSubmitting ? 'Opening Apple...' : 'Continue with Apple'
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
                disabled={!controller.canSwitchScreens}
                onPress={() => {
                  controller.handleAlternateScreenPress(() => {
                    router.replace(authRouteHref('/sign-up', returnToHref));
                  });
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
