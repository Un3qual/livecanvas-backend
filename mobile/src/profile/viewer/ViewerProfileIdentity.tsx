import { useEffect, useReducer, useRef } from 'react';
import { Text, TextInput, View } from 'react-native';
import { graphql, useMutation } from 'react-relay';

import type { ViewerProfileIdentityUpdateMutation } from '../../__generated__/ViewerProfileIdentityUpdateMutation.graphql';
import { AppButton } from '../../components/AppButton';
import { AppHeader } from '../../components/AppHeader';
import { useAppTheme } from '../../providers/ThemeProvider';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { profileScreenStyles as styles } from '../components/profileScreenStyles';
import {
  createProfileIdentityState,
  profileIdentityReducer,
  validateProfileIdentity,
} from '../profileIdentityState';
import { formatProfileIdentity } from '../profilePresentation';

type ViewerProfileIdentityProps = {
  readonly viewer: {
    readonly displayName?: string | null;
    readonly email?: string | null;
    readonly id: string;
    readonly username?: string | null;
  };
};

type MutationDisposable = {
  dispose: () => void;
};

const viewerProfileScreenUpdateIdentityMutation = graphql`
  mutation ViewerProfileIdentityUpdateMutation(
    $input: UpdateViewerProfileIdentityInput!
  ) {
    updateViewerProfileIdentity(input: $input) {
      user {
        id
        displayName
        username
      }
      errors {
        field
        message
      }
    }
  }
`;

export function ViewerProfileIdentity({
  viewer,
}: ViewerProfileIdentityProps) {
  const theme = useAppTheme();
  const [commitIdentity, isIdentityMutationInFlight] =
    useMutation<ViewerProfileIdentityUpdateMutation>(
      viewerProfileScreenUpdateIdentityMutation,
    );
  const [identityState, dispatchIdentity] = useReducer(
    profileIdentityReducer,
    {
      displayName: viewer.displayName,
      username: viewer.username,
    },
    createProfileIdentityState,
  );
  const attemptSequenceRef = useRef(0);
  const activeAttemptRef = useRef<number | null>(null);
  const activeDisposableRef = useRef<MutationDisposable | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    dispatchIdentity({
      type: 'reset',
      values: {
        displayName: viewer.displayName,
        username: viewer.username,
      },
    });
  }, [viewer.displayName, viewer.username]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      activeAttemptRef.current = null;
      activeDisposableRef.current?.dispose();
      activeDisposableRef.current = null;
    };
  }, []);

  function handleSave() {
    if (activeAttemptRef.current !== null) {
      return;
    }

    const validation = validateProfileIdentity(identityState.values);
    const attemptId = attemptSequenceRef.current + 1;
    attemptSequenceRef.current = attemptId;
    dispatchIdentity({ attemptId, type: 'submitted' });

    if (validation.input === null) {
      return;
    }

    activeAttemptRef.current = attemptId;

    // Relay callbacks can run synchronously in tests, so only retain the
    // disposable when this attempt is still active after commit returns.
    const disposable = commitIdentity({
      variables: { input: validation.input },
      onCompleted: (response) => {
        if (!finishAttempt(attemptId)) {
          return;
        }

        const result = response.updateViewerProfileIdentity;

        if (!result?.user || result.errors.length > 0) {
          dispatchIdentity({
            attemptId,
            errors: result?.errors,
            type: 'failed',
          });
          return;
        }

        dispatchIdentity({
          attemptId,
          type: 'succeeded',
          values: result.user,
        });
      },
      onError: () => {
        if (finishAttempt(attemptId)) {
          dispatchIdentity({ attemptId, errors: null, type: 'failed' });
        }
      },
    });

    if (activeAttemptRef.current === attemptId) {
      activeDisposableRef.current = disposable;
    } else {
      disposable.dispose();
    }
  }

  function finishAttempt(attemptId: number): boolean {
    if (!isMountedRef.current || activeAttemptRef.current !== attemptId) {
      return false;
    }

    activeAttemptRef.current = null;
    activeDisposableRef.current = null;
    return true;
  }

  const identity = formatProfileIdentity({
    displayName: identityState.confirmed.displayName,
    email: viewer.email,
    id: viewer.id,
    username: identityState.confirmed.username,
  });
  const isSaving =
    identityState.activeAttempt !== null || isIdentityMutationInFlight;

  return (
    <>
      <View style={styles.identity}>
        <ProfileAvatar initials={identity.initials} />
        <AppHeader
          eyebrow="Profile"
          title={identity.title}
          subtitle={identity.subtitle}
        />
      </View>
      <View style={styles.identityForm}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Profile identity
        </Text>
        <IdentityField
          error={identityState.fieldErrors.displayName}
          label="Display name"
          onChangeText={(value) =>
            dispatchIdentity({ field: 'displayName', type: 'changed', value })
          }
          placeholder="Your display name"
          value={identityState.values.displayName}
        />
        <IdentityField
          autoCapitalize="none"
          autoCorrect={false}
          error={identityState.fieldErrors.username}
          label="Username"
          onChangeText={(value) =>
            dispatchIdentity({ field: 'username', type: 'changed', value })
          }
          placeholder="your_username"
          value={identityState.values.username}
        />
        <AppButton
          disabled={isSaving}
          label={isSaving ? 'Saving identity...' : 'Save identity'}
          onPress={handleSave}
        />
        {identityState.generalError ? (
          <Text style={[styles.errorText, { color: theme.colors.error }]}>
            {identityState.generalError}
          </Text>
        ) : null}
      </View>
    </>
  );
}

type IdentityFieldProps = {
  readonly autoCapitalize?: 'none' | 'words';
  readonly autoCorrect?: boolean;
  readonly error: string | null;
  readonly label: string;
  readonly onChangeText: (value: string) => void;
  readonly placeholder: string;
  readonly value: string;
};

function IdentityField({
  autoCapitalize = 'words',
  autoCorrect,
  error,
  label,
  onChangeText,
  placeholder,
  value,
}: IdentityFieldProps) {
  const theme = useAppTheme();

  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        style={[
          styles.input,
          {
            backgroundColor: theme.colors.surfaceMuted,
            borderColor: error ? theme.colors.error : theme.colors.border,
            color: theme.colors.text,
          },
        ]}
        value={value}
      />
      {error ? (
        <Text style={[styles.errorText, { color: theme.colors.error }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
