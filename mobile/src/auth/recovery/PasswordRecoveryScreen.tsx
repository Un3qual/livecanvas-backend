import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useMutation } from 'react-relay';

import type { passwordRecoveryOperationsRequestMutation } from '../../__generated__/passwordRecoveryOperationsRequestMutation.graphql';
import { AppButton } from '../../components/AppButton';
import { AppCard } from '../../components/AppCard';
import { AppHeader } from '../../components/AppHeader';
import { AuthField } from '../../components/AuthField';
import { useAppTheme } from '../../providers/ThemeProvider';
import { authScreenStyles as styles } from '../screens/authEntryScreenStyles';
import { passwordRecoveryRequestMutation } from './passwordRecoveryOperations';
import {
  PASSWORD_RECOVERY_SUCCESS_COPY,
  buildPasswordRecoveryInput,
  formatRecoveryMutationErrors,
} from './passwordRecoveryState';

export function PasswordRecoveryScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const activeRequestRef = useRef(false);
  const [commitRequestPasswordReset, isRequestInFlight] =
    useMutation<passwordRecoveryOperationsRequestMutation>(
      passwordRecoveryRequestMutation,
    );

  const submitRecoveryRequest = () => {
    if (activeRequestRef.current || isRequestInFlight) {
      return;
    }

    const input = buildPasswordRecoveryInput({ email });

    if (!input) {
      setError('Enter a valid email address.');
      setSuccessMessage(null);
      return;
    }

    activeRequestRef.current = true;
    setError(null);
    setSuccessMessage(null);

    commitRequestPasswordReset({
      variables: { input },
      onCompleted: (payload) => {
        activeRequestRef.current = false;
        const result = payload.requestPasswordReset;

        if (!result || result.errors.length > 0) {
          setError(formatRecoveryMutationErrors(result?.errors));
          return;
        }

        setSuccessMessage(PASSWORD_RECOVERY_SUCCESS_COPY);
      },
      onError: () => {
        activeRequestRef.current = false;
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
              title="Reset password"
              subtitle="Enter your account email to receive reset instructions."
            />
            <View style={styles.form}>
              <AuthField
                autoComplete="email"
                error={error ? 'Check this email address.' : undefined}
                keyboardType="email-address"
                label="Email"
                onChangeText={(value) => {
                  setEmail(value);
                  setError(null);
                  setSuccessMessage(null);
                }}
                placeholder="you@example.com"
                textContentType="emailAddress"
                value={email}
              />
              <RecoveryMessage message={error} tone="error" />
              <RecoveryMessage message={successMessage} tone="success" />
              <AppButton
                disabled={isRequestInFlight}
                label={isRequestInFlight ? 'Sending...' : 'Send reset link'}
                onPress={submitRecoveryRequest}
              />
              <AppButton
                label="Back to sign in"
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
