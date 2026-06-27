import React, { Suspense, useReducer, type PropsWithChildren } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { graphql, useLazyLoadQuery } from 'react-relay';

import { AppButton } from '../../components/AppButton';
import { AppCard } from '../../components/AppCard';
import { AppHeader } from '../../components/AppHeader';
import { ScreenState } from '../../components/ScreenState';
import { useAppTheme } from '../../providers/ThemeProvider';
import { readConnectionNodes } from '../../relay/readConnectionNodes';
import { spacing, typography } from '../../theme/tokens';
import { liveSessionHref } from '../liveSessionNavigation';
import {
  LiveSessionSummaryCard,
  type LiveSessionSummary,
} from '../LiveSessionSummaryCard';
import type { LiveDiscoveryScreenQuery } from '../../__generated__/LiveDiscoveryScreenQuery.graphql';

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
  },
  section: {
    width: '100%',
    maxWidth: 420,
    gap: spacing.sm,
  },
  sectionTitle: typography.label,
  list: {
    gap: spacing.md,
  },
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  profileAction: {
    alignSelf: 'center',
  },
  emptyText: typography.body,
});

export function LiveDiscoveryScreen() {
  const [queryRetryKey, retryQuery] = useReducer((key: number) => key + 1, 0);

  return (
    <LiveDiscoveryErrorBoundary key={queryRetryKey} onRetry={retryQuery}>
      <Suspense
        fallback={
          <ScreenState state="loading" message="Loading live sessions..." />
        }
      >
        <LiveDiscoveryContent key={queryRetryKey} />
      </Suspense>
    </LiveDiscoveryErrorBoundary>
  );
}

export function shouldShowHostCreationAction(
  currentSession: LiveSessionSummary | null | undefined,
): boolean {
  return currentSession == null;
}

type LiveDiscoveryErrorBoundaryProps = PropsWithChildren<{
  onRetry: () => void;
}>;

type LiveDiscoveryErrorBoundaryState = {
  hasError: boolean;
};

class LiveDiscoveryErrorBoundary extends React.Component<
  LiveDiscoveryErrorBoundaryProps,
  LiveDiscoveryErrorBoundaryState
> {
  state: LiveDiscoveryErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): LiveDiscoveryErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <ScreenState
          state="error"
          message="We couldn't load live sessions. Check your connection and try again."
          onRetry={this.props.onRetry}
        />
      );
    }

    return this.props.children;
  }
}

function LiveDiscoveryContent() {
  const theme = useAppTheme();
  const router = useRouter();
  const data = useLazyLoadQuery<LiveDiscoveryScreenQuery>(
    graphql`
      query LiveDiscoveryScreenQuery($first: Int!) {
        liveNow(first: $first) {
          edges {
            node {
              id
              channelTopic
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
        viewer {
          id
          currentLiveSession {
            id
            channelTopic
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
    { first: 20 },
    { fetchPolicy: 'store-and-network' },
  );

  const currentSession = data.viewer?.currentLiveSession ?? null;
  const currentSessionId = currentSession?.id;
  const showHostCreationAction = shouldShowHostCreationAction(currentSession);
  const liveNowSessions = readConnectionNodes(data.liveNow).filter(
    (session) => session.id !== currentSessionId,
  );

  function openLiveSession(session: LiveSessionSummary) {
    router.push(liveSessionHref(session.id));
  }

  function openViewerProfile() {
    router.push('/profile');
  }

  function openHostBroadcast() {
    router.push('/host-broadcast');
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <AppHeader
        eyebrow="Home"
        title="Live now"
        subtitle="Join active sessions from people you can watch."
      />
      <View style={styles.actions}>
        {showHostCreationAction ? (
          <AppButton label="Host a live session" onPress={openHostBroadcast} />
        ) : null}
        <AppButton
          label="Open profile"
          onPress={openViewerProfile}
          style={styles.profileAction}
          variant="secondary"
        />
      </View>

      {currentSession ? (
        <View style={styles.section}>
          <SectionTitle title="Your live session" />
          <LiveSessionSummaryCard
            buttonLabel="Open session"
            onPress={() => openLiveSession(currentSession)}
            session={currentSession}
          />
        </View>
      ) : null}

      {liveNowSessions.length > 0 ? (
        <View style={styles.section}>
          <SectionTitle title="Discover live sessions" />
          <View style={styles.list}>
            {liveNowSessions.map((session) => (
              <LiveSessionSummaryCard
                buttonLabel="Watch live"
                key={session.id}
                onPress={() => openLiveSession(session)}
                session={session}
              />
            ))}
          </View>
        </View>
      ) : (
        <View style={styles.section}>
          <SectionTitle title="Discover live sessions" />
          <AppCard>
            <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
              No live sessions are available right now.
            </Text>
          </AppCard>
        </View>
      )}
    </ScrollView>
  );
}

function SectionTitle({ title }: { title: string }) {
  const theme = useAppTheme();

  return (
    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
      {title}
    </Text>
  );
}
