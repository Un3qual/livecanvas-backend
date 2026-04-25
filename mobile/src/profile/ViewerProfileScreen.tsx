import React, { Suspense, useReducer, type PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { graphql, useLazyLoadQuery } from 'react-relay';

import { AppCard } from '../components/AppCard';
import { AppHeader } from '../components/AppHeader';
import { ScreenState } from '../components/ScreenState';
import { useAppTheme } from '../providers/ThemeProvider';
import { radius, spacing, typography } from '../theme/tokens';
import {
  countConnectionEdges,
  formatFollowRequestPreview,
  formatPrivacyModeLabel,
  formatProfileIdentity,
} from './profilePresentation';
import type { ViewerProfileScreenQuery } from './__generated__/ViewerProfileScreenQuery.graphql';

type ViewerProfileData = ViewerProfileScreenQuery['response'];
type ViewerProfileViewer = NonNullable<ViewerProfileData['viewer']>;
type ProfileUserEdge = NonNullable<
  NonNullable<ViewerProfileViewer['followers']>['edges']
>[number];
type ProfileUser = NonNullable<NonNullable<ProfileUserEdge>['node']>;
type PendingFollowRequestEdge = NonNullable<
  NonNullable<ViewerProfileData['viewerPendingFollowRequests']>['edges']
>[number];
type PendingFollowRequest = NonNullable<
  NonNullable<PendingFollowRequestEdge>['node']
>;

type ConnectionLike<TNode> = {
  readonly edges?:
    | ReadonlyArray<{ readonly node?: TNode | null } | null | undefined>
    | null;
} | null | undefined;

export function ViewerProfileScreen() {
  const [queryRetryKey, retryQuery] = useReducer((key: number) => key + 1, 0);

  return (
    <ViewerProfileErrorBoundary key={queryRetryKey} onRetry={retryQuery}>
      <Suspense
        fallback={
          <ScreenState state="loading" message="Loading your profile..." />
        }
      >
        <ViewerProfileContent key={queryRetryKey} />
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

function ViewerProfileContent() {
  const theme = useAppTheme();
  const data = useLazyLoadQuery<ViewerProfileScreenQuery>(
    graphql`
      query ViewerProfileScreenQuery {
        viewer {
          id
          email
          privacyMode
          followers(first: 10) {
            edges {
              node {
                id
                email
                privacyMode
              }
            }
          }
          following(first: 10) {
            edges {
              node {
                id
                email
                privacyMode
              }
            }
          }
        }
        viewerPendingFollowRequests(first: 3) {
          edges {
            node {
              id
              state
              requestedAt
              follower {
                id
                email
                privacyMode
              }
            }
          }
        }
      }
    `,
    {},
    { fetchPolicy: 'store-and-network' },
  );

  const viewer = data.viewer;

  if (!viewer) {
    return (
      <ScreenState
        state="empty"
        message="Profile data is unavailable for this session."
      />
    );
  }

  const identity = formatProfileIdentity(viewer);
  const privacy = formatPrivacyModeLabel(viewer.privacyMode);
  const followers = readConnectionNodes(viewer.followers);
  const following = readConnectionNodes(viewer.following);
  const pendingRequests = readConnectionNodes(data.viewerPendingFollowRequests);

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <AppCard>
        <View style={styles.identity}>
          <View
            style={[
              styles.avatar,
              { backgroundColor: theme.colors.surfaceMuted },
            ]}
          >
            <Text style={[styles.avatarText, { color: theme.colors.accent }]}>
              {identity.initials}
            </Text>
          </View>
          <AppHeader
            eyebrow="Profile"
            title={identity.title}
            subtitle={identity.subtitle}
          />
        </View>
        <View style={styles.stats}>
          <SummaryStat
            label="Followers"
            value={countConnectionEdges(viewer.followers)}
          />
          <SummaryStat
            label="Following"
            value={countConnectionEdges(viewer.following)}
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
        </View>
      </AppCard>

      <AppCard>
        <SectionHeading
          title="Followers"
          subtitle={`${followers.length} visible in preview`}
        />
        <ProfilePreviewList
          users={followers}
          emptyMessage="No followers are visible yet."
        />
      </AppCard>

      <AppCard>
        <SectionHeading
          title="Following"
          subtitle={`${following.length} visible in preview`}
        />
        <ProfilePreviewList
          users={following}
          emptyMessage="No followed profiles are visible yet."
        />
      </AppCard>

      <AppCard>
        <SectionHeading
          title="Requests"
          subtitle={`${pendingRequests.length} pending in preview`}
        />
        <PendingRequestPreviewList requests={pendingRequests} />
      </AppCard>
    </ScrollView>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  const theme = useAppTheme();

  return (
    <View
      style={[
        styles.stat,
        {
          backgroundColor: theme.colors.surfaceMuted,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <Text style={[styles.statValue, { color: theme.colors.text }]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: theme.colors.textMuted }]}>
        {label}
      </Text>
    </View>
  );
}

function SectionHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  const theme = useAppTheme();

  return (
    <View style={styles.sectionHeading}>
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
        {title}
      </Text>
      <Text style={[styles.bodyText, { color: theme.colors.textMuted }]}>
        {subtitle}
      </Text>
    </View>
  );
}

function ProfilePreviewList({
  users,
  emptyMessage,
}: {
  users: ReadonlyArray<ProfileUser>;
  emptyMessage: string;
}) {
  if (users.length === 0) {
    return <EmptyCardMessage message={emptyMessage} />;
  }

  return (
    <View style={styles.list}>
      {users.map((user) => (
        <ProfilePreviewRow key={user.id} user={user} />
      ))}
    </View>
  );
}

function ProfilePreviewRow({ user }: { user: ProfileUser }) {
  const theme = useAppTheme();
  const identity = formatProfileIdentity(user);
  const privacy = formatPrivacyModeLabel(user.privacyMode);

  return (
    <View style={[styles.row, { borderColor: theme.colors.border }]}>
      <View
        style={[
          styles.smallAvatar,
          { backgroundColor: theme.colors.surfaceMuted },
        ]}
      >
        <Text style={[styles.smallAvatarText, { color: theme.colors.accent }]}>
          {identity.initials}
        </Text>
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, { color: theme.colors.text }]}>
          {identity.title}
        </Text>
        <Text style={[styles.rowSubtitle, { color: theme.colors.textMuted }]}>
          {privacy.label}
        </Text>
      </View>
    </View>
  );
}

function PendingRequestPreviewList({
  requests,
}: {
  requests: ReadonlyArray<PendingFollowRequest>;
}) {
  if (requests.length === 0) {
    return <EmptyCardMessage message="No pending follow requests." />;
  }

  return (
    <View style={styles.list}>
      {requests.map((request) => (
        <PendingRequestPreviewRow key={request.id} request={request} />
      ))}
    </View>
  );
}

function PendingRequestPreviewRow({
  request,
}: {
  request: PendingFollowRequest;
}) {
  const theme = useAppTheme();
  const identity = formatProfileIdentity(request.follower);
  const requestPreview = formatFollowRequestPreview(request);

  return (
    <View style={[styles.row, { borderColor: theme.colors.border }]}>
      <View
        style={[
          styles.smallAvatar,
          { backgroundColor: theme.colors.surfaceMuted },
        ]}
      >
        <Text style={[styles.smallAvatarText, { color: theme.colors.accent }]}>
          {identity.initials}
        </Text>
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, { color: theme.colors.text }]}>
          {identity.title}
        </Text>
        <Text style={[styles.rowSubtitle, { color: theme.colors.textMuted }]}>
          {requestPreview.stateLabel} - {requestPreview.requestedAtLabel}
        </Text>
      </View>
    </View>
  );
}

function EmptyCardMessage({ message }: { message: string }) {
  const theme = useAppTheme();

  return (
    <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
      {message}
    </Text>
  );
}

function readConnectionNodes<TNode>(
  connection: ConnectionLike<TNode>,
): Array<NonNullable<TNode>> {
  return (
    connection?.edges
      ?.map((edge) => edge?.node)
      .filter((node): node is NonNullable<TNode> => node != null) ?? []
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  identity: {
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stat: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    gap: spacing.xs,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  statLabel: typography.label,
  privacyPanel: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  sectionHeading: {
    gap: spacing.xs,
  },
  sectionTitle: typography.label,
  bodyText: typography.body,
  list: {
    gap: spacing.sm,
  },
  row: {
    minHeight: 64,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  smallAvatar: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallAvatarText: {
    fontSize: 14,
    fontWeight: '700',
  },
  rowBody: {
    flex: 1,
    gap: spacing.xs,
  },
  rowTitle: typography.label,
  rowSubtitle: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  emptyText: {
    ...typography.body,
    textAlign: 'center',
  },
});
