import { type PropsWithChildren, useState } from 'react';
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
  magicLinkBusyLabel: string;
  magicLinkLabel: string;
  subtitle: string;
  title: string;
};

type AuthEntryController = ReturnType<typeof useAuthEntryController>;

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
    magicLinkBusyLabel: 'Sending sign-in link...',
    magicLinkLabel: 'Email me a sign-in link',
    subtitle:
      'Use your password, an email link, or a linked provider.',
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
    magicLinkBusyLabel: 'Sending sign-up link...',
    magicLinkLabel: 'Email me a sign-up link',
    subtitle:
      'Create an account with a password, an email link, or a supported provider.',
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
  // Only forward the sanitized returnTo value so auth switches cannot preserve
  // an arbitrary redirect target.
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

  const handleMagicLinkSubmit = () => {
    controller.submitMagicLink(email, successHref).catch(() => undefined);
  };

  const handleAppleSubmit = async () => {
    const success = await controller.submitApple();

    if (success) {
      router.replace(successHref);
    }
  };

  const handleEmailChange = (value: string) => {
    controller.clearTransientErrors();
    setEmail(value);
  };

  const handlePasswordChange = (value: string) => {
    controller.clearTransientErrors();
    setPassword(value);
  };

  const handlePasswordConfirmationChange = (value: string) => {
    controller.clearTransientErrors();
    setPasswordConfirmation(value);
  };

  const handleAlternateScreenPress = () => {
    controller.handleAlternateScreenPress(() => {
      router.replace(authRouteHref(copy.alternateHref, returnToHref));
    });
  };

  const handlePasswordRecoveryPress = () => {
    router.push('/password-recovery');
  };

  return (
    <AuthEntryScreenLayout backgroundColor={theme.colors.background}>
      <AuthEntryCard
        controller={controller}
        copy={copy}
        email={email}
        mode={mode}
        onAlternateScreenPress={handleAlternateScreenPress}
        onAppleSubmit={handleAppleSubmit}
        onEmailChange={handleEmailChange}
        onGoogleSubmit={handleGoogleSubmit}
        onMagicLinkSubmit={handleMagicLinkSubmit}
        onPasswordRecoveryPress={handlePasswordRecoveryPress}
        onPasswordChange={handlePasswordChange}
        onPasswordConfirmationChange={handlePasswordConfirmationChange}
        onPasswordSubmit={handlePasswordSubmit}
        password={password}
        passwordConfirmation={passwordConfirmation}
      />
    </AuthEntryScreenLayout>
  );
}

type AuthEntryCardProps = {
  controller: AuthEntryController;
  copy: AuthEntryCopy;
  email: string;
  mode: AuthEntryMode;
  onAlternateScreenPress: () => void;
  onAppleSubmit: () => void;
  onEmailChange: (value: string) => void;
  onGoogleSubmit: () => void;
  onMagicLinkSubmit: () => void;
  onPasswordChange: (value: string) => void;
  onPasswordConfirmationChange: (value: string) => void;
  onPasswordRecoveryPress: () => void;
  onPasswordSubmit: () => void;
  password: string;
  passwordConfirmation: string;
};

type AuthEntryScreenLayoutProps = PropsWithChildren<{
  backgroundColor: string;
}>;

function AuthEntryScreenLayout({
  backgroundColor,
  children,
}: AuthEntryScreenLayoutProps) {
  return (
    <View style={[styles.screen, { backgroundColor }]}>
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
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function AuthEntryCard({
  controller,
  copy,
  email,
  mode,
  onAlternateScreenPress,
  onAppleSubmit,
  onEmailChange,
  onGoogleSubmit,
  onMagicLinkSubmit,
  onPasswordChange,
  onPasswordConfirmationChange,
  onPasswordRecoveryPress,
  onPasswordSubmit,
  password,
  passwordConfirmation,
}: AuthEntryCardProps) {
  return (
    <AppCard>
      <AppHeader
        eyebrow={copy.eyebrow}
        subtitle={copy.subtitle}
        title={copy.title}
      />
      <AuthEntryForm
        controller={controller}
        copy={copy}
        email={email}
        mode={mode}
        onAppleSubmit={onAppleSubmit}
        onEmailChange={onEmailChange}
        onGoogleSubmit={onGoogleSubmit}
        onMagicLinkSubmit={onMagicLinkSubmit}
        onPasswordChange={onPasswordChange}
        onPasswordConfirmationChange={onPasswordConfirmationChange}
        onPasswordRecoveryPress={onPasswordRecoveryPress}
        onPasswordSubmit={onPasswordSubmit}
        password={password}
        passwordConfirmation={passwordConfirmation}
      />
      <AuthEntryFooter
        controller={controller}
        copy={copy}
        onAlternateScreenPress={onAlternateScreenPress}
      />
    </AppCard>
  );
}

type AuthEntryFormProps = Omit<
  AuthEntryCardProps,
  'onAlternateScreenPress'
>;

function AuthEntryForm({
  controller,
  copy,
  email,
  mode,
  onAppleSubmit,
  onEmailChange,
  onGoogleSubmit,
  onMagicLinkSubmit,
  onPasswordChange,
  onPasswordConfirmationChange,
  onPasswordRecoveryPress,
  onPasswordSubmit,
  password,
  passwordConfirmation,
}: AuthEntryFormProps) {
  return (
    <View style={styles.form}>
      <AuthField
        autoComplete="email"
        error={controller.fieldErrors.email}
        keyboardType="email-address"
        label="Email"
        onChangeText={onEmailChange}
        placeholder="you@example.com"
        textContentType="emailAddress"
        value={email}
      />
      <AuthField
        autoComplete={copy.passwordAutoComplete}
        error={controller.fieldErrors.password}
        label="Password"
        onChangeText={onPasswordChange}
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
          onChangeText={onPasswordConfirmationChange}
          placeholder="Re-enter your password"
          secureTextEntry
          textContentType="newPassword"
          value={passwordConfirmation}
        />
      ) : null}
      <AuthEntryFormError error={controller.formError} />
      <AuthEntryFormMessage message={controller.magicLinkMessage} />
      <AppButton
        disabled={controller.isBusy}
        label={
          controller.isPasswordSubmitting
            ? copy.primaryBusyLabel
            : copy.primaryLabel
        }
        onPress={onPasswordSubmit}
      />
      {mode === 'signIn' ? (
        <AppButton
          disabled={controller.isBusy}
          label="Forgot password?"
          onPress={onPasswordRecoveryPress}
          variant="secondary"
        />
      ) : null}
      <AuthEntryAlternativeActions
        controller={controller}
        copy={copy}
        onAppleSubmit={onAppleSubmit}
        onGoogleSubmit={onGoogleSubmit}
        onMagicLinkSubmit={onMagicLinkSubmit}
      />
    </View>
  );
}

function AuthEntryFormError({ error }: { error: string | null }) {
  const theme = useAppTheme();

  if (!error) {
    return null;
  }

  return (
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
        {error}
      </Text>
    </View>
  );
}

function AuthEntryFormMessage({ message }: { message: string | null }) {
  const theme = useAppTheme();

  return message ? (
    <Text style={[styles.successText, { color: theme.colors.text }]}>{message}</Text>
  ) : null;
}

function AuthEntryAlternativeActions({
  controller,
  copy,
  onAppleSubmit,
  onGoogleSubmit,
  onMagicLinkSubmit,
}: {
  controller: AuthEntryController;
  copy: AuthEntryCopy;
  onAppleSubmit: () => void;
  onGoogleSubmit: () => void;
  onMagicLinkSubmit: () => void;
}) {
  return (
    <>
      <AuthEntryAlternativeDivider />
      <AppButton
        disabled={controller.isBusy}
        label={
          controller.isMagicLinkSubmitting
            ? copy.magicLinkBusyLabel
            : copy.magicLinkLabel
        }
        onPress={onMagicLinkSubmit}
        variant="secondary"
      />
      {controller.hasGoogleAuthOption ? (
        <AppButton
          disabled={controller.isBusy}
          label={
            controller.isGoogleSubmitting
              ? 'Opening Google...'
              : 'Continue with Google'
          }
          onPress={onGoogleSubmit}
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
          onPress={onAppleSubmit}
          variant="secondary"
        />
      ) : null}
    </>
  );
}

function AuthEntryAlternativeDivider() {
  const theme = useAppTheme();

  return (
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
        or use another method
      </Text>
      <View
        style={[
          styles.dividerLine,
          { backgroundColor: theme.colors.border },
        ]}
      />
    </View>
  );
}

function AuthEntryFooter({
  controller,
  copy,
  onAlternateScreenPress,
}: {
  controller: AuthEntryController;
  copy: AuthEntryCopy;
  onAlternateScreenPress: () => void;
}) {
  const theme = useAppTheme();

  return (
    <View style={styles.footerRow}>
      <Text style={[styles.footerText, { color: theme.colors.textMuted }]}>
        {copy.footerPrompt}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !controller.canSwitchScreens }}
        disabled={!controller.canSwitchScreens}
        hitSlop={8}
        onPress={onAlternateScreenPress}
      >
        <Text style={[styles.footerAction, { color: theme.colors.accent }]}>
          {copy.alternateLabel}
        </Text>
      </Pressable>
    </View>
  );
}
