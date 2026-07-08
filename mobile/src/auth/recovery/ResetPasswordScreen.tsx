import { useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useMutation } from 'react-relay';

import type { passwordRecoveryOperationsResetMutation } from '../../__generated__/passwordRecoveryOperationsResetMutation.graphql';
import { AppButton } from '../../components/AppButton';
import { AppCard } from '../../components/AppCard';
import { AppHeader } from '../../components/AppHeader';
import { AuthField } from '../../components/AuthField';
import { useAppTheme } from '../../providers/ThemeProvider';
import { authScreenStyles as styles } from '../screens/authEntryScreenStyles';
import { passwordRecoveryResetMutation } from './passwordRecoveryOperations';
import {
  PASSWORD_RESET_SUCCESS_COPY,
  buildResetPasswordInput,
  formatRecoveryMutationErrors,
  readResetPasswordTokenParam,
} from './passwordRecoveryState';

export function ResetPasswordScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { token: rawToken } = useLocalSearchParams<{
    token?: string | string[];
  }>();
  const [token, setToken] = useState(() => readResetPasswordTokenParam(rawToken));
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const activeResetRef = useRef(false);
  const [commitResetPassword, isResetInFlight] =
    useMutation<passwordRecoveryOperationsResetMutation>(
      passwordRecoveryResetMutation,
    );

  const submitPasswordReset = () => {
    if (activeResetRef.current || isResetInFlight) {
      return;
    }

    const input = buildResetPasswordInput({
      password,
      passwordConfirmation,
      token,
    });

    if (!input) {
      setError('Enter the reset token and new password.');
      setSuccessMessage(null);
      return;
    }

    activeResetRef.current = true;
    setError(null);
    setSuccessMessage(null);

    commitResetPassword({
      variables: { input },
      onCompleted: (payload) => {
        activeResetRef.current = false;
        const result = payload.resetPassword;

        if (!result?.reset || result.errors.length > 0) {
          setError(formatRecoveryMutationErrors(result?.errors));
          return;
        }

        setSuccessMessage(PASSWORD_RESET_SUCCESS_COPY);
      },
      onError: () => {
        activeResetRef.current = false;
        setError(formatRecoveryMutationErrors(null));
      },
    });
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
              eyebrow="Account recovery"
              title="Choose a new password"
              subtitle="Use the reset token from your email, or paste it here."
            />
            <View style={styles.form}>
              <AuthField
                autoComplete="one-time-code"
                label="Reset token"
                onChangeText={(value) => {
                  setToken(value);
                  setError(null);
                  setSuccessMessage(null);
                }}
                placeholder="Paste reset token"
                value={token}
              />
              <AuthField
                autoComplete="new-password"
                label="New password"
                onChangeText={(value) => {
                  setPassword(value);
                  setError(null);
                  setSuccessMessage(null);
                }}
                placeholder="Enter a new password"
                secureTextEntry
                textContentType="newPassword"
                value={password}
              />
              <AuthField
                autoComplete="new-password"
                label="Confirm password"
                onChangeText={(value) => {
                  setPasswordConfirmation(value);
                  setError(null);
                  setSuccessMessage(null);
                }}
                placeholder="Re-enter the new password"
                secureTextEntry
                textContentType="newPassword"
                value={passwordConfirmation}
              />
              <RecoveryMessage message={error} tone="error" />
              <RecoveryMessage message={successMessage} tone="success" />
              <AppButton
                disabled={isResetInFlight}
                label={isResetInFlight ? 'Resetting...' : 'Reset password'}
                onPress={submitPasswordReset}
              />
              <AppButton
                label="Sign in"
                onPress={() => router.replace('/sign-in')}
                variant="secondary"
              />
            </View>
          </AppCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function RecoveryMessage({
  message,
  tone,
}: {
  message: string | null;
  tone: 'error' | 'success';
}) {
  const theme = useAppTheme();

  if (!message) {
    return null;
  }

  const color = tone === 'error' ? theme.colors.error : theme.colors.text;

  return <Text style={[styles.errorText, { color }]}>{message}</Text>;
}
