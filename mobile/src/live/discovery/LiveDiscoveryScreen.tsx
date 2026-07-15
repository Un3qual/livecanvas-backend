import React, { Suspense, useReducer, type PropsWithChildren } from 'react';
import { useRouter } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { graphql, useLazyLoadQuery } from 'react-relay';

import { AppButton } from '../../components/AppButton';
import { AppCard } from '../../components/AppCard';
import { AppHeader } from '../../components/AppHeader';
import { ScreenState } from '../../components/ScreenState';
import { useAppTheme } from '../../providers/ThemeProvider';
import { PRIVACY_SENSITIVE_FETCH_OPTIONS } from '../../relay/privacySensitiveFetch';
import { readConnectionNodes } from '../../relay/readConnectionNodes';
import { spacing, typography } from '../../theme/tokens';
import { liveSessionHref } from '../liveSessionNavigation';
import {
  LiveSessionSummaryCard,
  type LiveSessionSummary,
} from '../components/LiveSessionSummaryCard';
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

type LiveDiscoveryHomeAction = {
  key: 'host' | 'profile' | 'diagnostics';
  label: string;
  route: '/host-broadcast' | '/profile' | '/diagnostics';
  variant: 'primary' | 'secondary';
};

export function LiveDiscoveryScreen() {
  const [queryRetryKey, retryQuery] = useReducer((key: number) => key + 1, 0);

  return (
    <LiveDiscoveryErrorBoundary key={queryRetryKey} onRetry={retryQuery}>
      <Suspense
        fallback={
          <ScreenState state="loading" message="Loading live sessions..." />
        }
      >
        <LiveDiscoveryContent fetchKey={queryRetryKey} key={queryRetryKey} />
      </Suspense>
    </LiveDiscoveryErrorBoundary>
  );
}

export function shouldShowHostCreationAction(
  currentSession?: LiveSessionSummary | null,
): boolean {
  return currentSession == null;
}

export function createLiveDiscoveryHomeActions(
  showHostCreationAction: boolean,
): LiveDiscoveryHomeAction[] {
  return [
    ...(showHostCreationAction
      ? ([
          {
            key: 'host',
            label: 'Host a live session',
            route: '/host-broadcast',
            variant: 'primary',
          },
        ] satisfies LiveDiscoveryHomeAction[])
      : []),
    {
      key: 'profile',
      label: 'Open profile',
      route: '/profile',
      variant: 'secondary',
    },
    {
      key: 'diagnostics',
      label: 'Diagnostics',
      route: '/diagnostics',
      variant: 'secondary',
    },
  ];
}

export function pushLiveDiscoveryHomeAction(
  router: { push: (route: LiveDiscoveryHomeAction['route']) => void },
  action: Pick<LiveDiscoveryHomeAction, 'route'>,
) {
  router.push(action.route);
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

function LiveDiscoveryContent({ fetchKey }: { fetchKey: number }) {
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
                displayName
                email
                username
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
              displayName
              email
              username
            }
          }
        }
      }
    `,
    { first: 20 },
    { ...PRIVACY_SENSITIVE_FETCH_OPTIONS, fetchKey },
  );

  const currentSession = data.viewer?.currentLiveSession ?? null;
  const currentSessionId = currentSession?.id;
  const showHostCreationAction = shouldShowHostCreationAction(currentSession);
  const homeActions = createLiveDiscoveryHomeActions(showHostCreationAction);
  const liveNowSessions = readConnectionNodes(data.liveNow).filter(
    (session) => session.id !== currentSessionId,
  );

  function openLiveSession(session: LiveSessionSummary) {
    router.push(liveSessionHref(session.id));
  }

  return (
    <FlatList
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      data={liveNowSessions}
      keyExtractor={(session) => session.id}
      ListEmptyComponent={
        <View style={styles.section}>
          <SectionTitle title="Discover live sessions" />
          <AppCard>
            <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
              No live sessions are available right now.
            </Text>
          </AppCard>
        </View>
      }
      ListHeaderComponent={
        <>
          <AppHeader
            eyebrow="Home"
            title="Live now"
            subtitle="Join active sessions from people you can watch."
          />
          <View style={styles.actions}>
            {homeActions.map((action) => (
              <AppButton
                key={action.key}
                label={action.label}
                onPress={() => pushLiveDiscoveryHomeAction(router, action)}
                style={
                  action.key === 'profile' ? styles.profileAction : undefined
                }
                variant={action.variant}
              />
            ))}
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
            </View>
          ) : null}
        </>
      }
      renderItem={({ item }) => (
        <View style={styles.section}>
          <LiveSessionSummaryCard
            buttonLabel="Watch live"
            onPress={() => openLiveSession(item)}
            session={item}
          />
        </View>
      )}
    />
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
