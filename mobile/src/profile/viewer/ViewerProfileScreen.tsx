import React, {
  Suspense,
  useEffect,
  useReducer,
  type PropsWithChildren,
} from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { graphql, useLazyLoadQuery, useMutation } from 'react-relay';

import { AppButton } from '../../components/AppButton';
import { AppCard } from '../../components/AppCard';
import { AppHeader } from '../../components/AppHeader';
import { ScreenState } from '../../components/ScreenState';
import { liveSessionHref } from '../../live/liveSessionNavigation';
import { LiveSessionSummaryCard } from '../../live/components/LiveSessionSummaryCard';
import { useAppTheme } from '../../providers/ThemeProvider';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { profileScreenStyles as styles } from '../components/profileScreenStyles';
import {
  formatPrivacyModeLabel,
  formatProfileIdentity,
} from '../profilePresentation';
import {
  createPrivacyModeState,
  formatMutationErrors,
  nextPrivacyMode,
  privacyModeReducer,
} from '../privacyModeReducer';
import type { ViewerProfileScreenPrivacyModeMutation } from '../../__generated__/ViewerProfileScreenPrivacyModeMutation.graphql';
import type { ViewerProfileScreenQuery } from '../../__generated__/ViewerProfileScreenQuery.graphql';
import { ViewerProfileSocialSectionsBoundary } from './ViewerProfileSocialSections';

const viewerProfileScreenPrivacyModeMutation = graphql`
  mutation ViewerProfileScreenPrivacyModeMutation(
    $input: UpdateViewerPrivacyModeInput!
  ) {
    updateViewerPrivacyMode(input: $input) {
      user {
        id
        privacyMode
      }
      errors {
        field
        message
      }
    }
  }
`;

export function ViewerProfileScreen() {
  const [queryRetryKey, retryQuery] = useReducer((key: number) => key + 1, 0);

  return (
    <ViewerProfileErrorBoundary key={queryRetryKey} onRetry={retryQuery}>
      <Suspense
        fallback={
          <ScreenState state="loading" message="Loading your profile..." />
        }
      >
        <ViewerProfileContent fetchKey={queryRetryKey} key={queryRetryKey} />
      </Suspense>
    </ViewerProfileErrorBoundary>
  );
}

type ViewerProfileErrorBoundaryProps = PropsWithChildren<{
  onRetry: () => void;
}>;

type ViewerProfileErrorBoundaryState = {
  hasError: boolean;
};

class ViewerProfileErrorBoundary extends React.Component<
  ViewerProfileErrorBoundaryProps,
  ViewerProfileErrorBoundaryState
> {
  state: ViewerProfileErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ViewerProfileErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <ScreenState
          state="error"
          message="We couldn't load your profile. Check your connection and try again."
          onRetry={this.props.onRetry}
        />
      );
    }

    return this.props.children;
  }
}

function ViewerProfileContent({ fetchKey }: { fetchKey: number }) {
  const theme = useAppTheme();
  const router = useRouter();
  const data = useLazyLoadQuery<ViewerProfileScreenQuery>(
    graphql`
      query ViewerProfileScreenQuery {
        viewer {
          id
          email
          privacyMode
          currentLiveSession {
            id
            status
            visibility
            insertedAt
            startedAt
            endedAt
            host {
              id
              email
            }
          }
        }
      }
    `,
    {},
    { fetchKey, fetchPolicy: 'store-and-network' },
  );

  const viewer = data.viewer;
  const [commitPrivacyMode, isPrivacyModeMutationInFlight] =
    useMutation<ViewerProfileScreenPrivacyModeMutation>(
      viewerProfileScreenPrivacyModeMutation,
    );
  const [privacyModeState, dispatchPrivacyMode] = useReducer(
    privacyModeReducer,
    viewer?.privacyMode ?? '',
    createPrivacyModeState,
  );
  useEffect(() => {
    if (viewer?.privacyMode != null) {
      dispatchPrivacyMode({ mode: viewer.privacyMode, type: 'reset' });
    }
  }, [viewer?.privacyMode]);

  function handlePrivacyModePress() {
    const requestedPrivacyMode = nextPrivacyMode(
      privacyModeState.currentMode,
    );

    if (isPrivacyModeMutationInFlight || requestedPrivacyMode == null) {
      return;
    }

    dispatchPrivacyMode({ mode: requestedPrivacyMode, type: 'submit' });

    commitPrivacyMode({
      variables: {
        input: {
          privacyMode: requestedPrivacyMode,
        },
      },
      onCompleted: (response) => {
        const result = response.updateViewerPrivacyMode;

        if (!result?.user || result.errors.length > 0) {
          dispatchPrivacyMode({
            message: formatMutationErrors(result?.errors),
            type: 'error',
          });
          return;
        }

        dispatchPrivacyMode({
          mode: result.user.privacyMode,
          type: 'success',
        });
      },
      onError: () => {
        dispatchPrivacyMode({
          message:
            'We could not update privacy mode. Check your connection and try again.',
          type: 'error',
        });
      },
    });
  }

  if (!viewer) {
    return (
      <ScreenState
        state="empty"
        message="Profile data is unavailable for this session."
      />
    );
  }

  const identity = formatProfileIdentity(viewer);
  const displayedPrivacyMode =
    privacyModeState.pendingMode ??
    privacyModeState.currentMode ??
    viewer.privacyMode;
  const requestedPrivacyMode = nextPrivacyMode(
    privacyModeState.currentMode,
  );
  const privacy = formatPrivacyModeLabel(displayedPrivacyMode);
  const privacyButtonLabel = isPrivacyModeMutationInFlight
    ? 'Saving...'
    : requestedPrivacyMode === 'PRIVATE'
      ? 'Switch to private'
      : requestedPrivacyMode === 'PUBLIC'
        ? 'Switch to public'
        : 'Privacy unavailable';
  const currentLiveSession = viewer.currentLiveSession ?? null;

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
    >
      <AppCard>
        <View style={styles.identity}>
          <ProfileAvatar initials={identity.initials} />
          <AppHeader
            eyebrow="Profile"
            title={identity.title}
            subtitle={identity.subtitle}
          />
        </View>
        <View
          style={[
            styles.privacyPanel,
            {
              backgroundColor: theme.colors.surfaceMuted,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            {privacy.label}
          </Text>
          <Text style={[styles.bodyText, { color: theme.colors.textMuted }]}>
            {privacy.description}
          </Text>
          <AppButton
            disabled={
              isPrivacyModeMutationInFlight || requestedPrivacyMode == null
            }
            label={privacyButtonLabel}
            onPress={handlePrivacyModePress}
            variant="secondary"
          />
          {privacyModeState.errorMessage ? (
            <Text style={[styles.errorText, { color: theme.colors.error }]}>
              {privacyModeState.errorMessage}
            </Text>
          ) : null}
        </View>
      </AppCard>

      {currentLiveSession ? (
        <LiveSessionSummaryCard
          buttonLabel="Open live session"
          onPress={() => router.push(liveSessionHref(currentLiveSession.id))}
          session={currentLiveSession}
        />
      ) : null}

      <ViewerProfileSocialSectionsBoundary />
    </ScrollView>
  );
}
