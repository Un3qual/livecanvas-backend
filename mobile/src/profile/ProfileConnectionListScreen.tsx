import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import {
  fetchQuery,
  useLazyLoadQuery,
  useRelayEnvironment,
} from 'react-relay';

import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { AppHeader } from '../components/AppHeader';
import { ScreenState } from '../components/ScreenState';
import { useAppTheme } from '../providers/ThemeProvider';
import { readConnectionNodes } from '../relay/readConnectionNodes';
import { spacing, typography } from '../theme/tokens';
import {
  PROFILE_CONNECTION_QUERY_VARIABLES,
  otherFollowersQuery,
  otherFollowingQuery,
  viewerFollowersQuery,
  viewerFollowingQuery,
} from './profileConnectionOperations';
import {
  appendProfileConnectionNodes,
  readProfileConnectionPageInfo,
  type ProfileConnectionPageInfo,
} from './profileConnectionPagination';

export type ProfileConnectionListKind =
  | 'viewerFollowers'
  | 'viewerFollowing'
  | 'otherFollowers'
  | 'otherFollowing';

type ProfileConnectionUser = {
  readonly email: string | null | undefined;
  readonly id: string;
  readonly privacyMode: string;
};

type UserConnection = {
  readonly edges?: ReadonlyArray<{
    readonly node?: ProfileConnectionUser | null;
  } | null> | null;
  readonly pageInfo?: ProfileConnectionPageInfo | null;
};

type ProfileConnectionQueryData = {
  readonly node?: {
    readonly __typename?: string;
    readonly followers?: UserConnection | null;
    readonly following?: UserConnection | null;
    readonly id?: string;
  } | null;
  readonly viewer?: {
    readonly followers?: UserConnection | null;
    readonly following?: UserConnection | null;
    readonly id?: string;
  } | null;
};

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
  row: {
    borderWidth: 1,
    padding: spacing.md,
  },
  rowBody: {
    gap: spacing.xs,
  },
  rowTitle: typography.label,
  bodyText: typography.body,
  loadMorePanel: {
    gap: spacing.sm,
  },
});

export function ProfileConnectionListScreen({
  kind,
  profileId,
}: {
  kind: ProfileConnectionListKind;
  profileId?: string | null;
}) {
  const theme = useAppTheme();
  const router = useRouter();
  const relayEnvironment = useRelayEnvironment();
  const config = profileConnectionConfig(kind);
  const variables = profileId
    ? { ...PROFILE_CONNECTION_QUERY_VARIABLES, id: profileId }
    : PROFILE_CONNECTION_QUERY_VARIABLES;
  const data = useLazyLoadQuery(config.query, variables, {
    // Connection members can block the viewer between visits. Do not render
    // cached identities before the server reapplies directional visibility.
    fetchPolicy: 'network-only',
  }) as ProfileConnectionQueryData;
  const initialConnection = selectProfileConnection(data, kind);
  const initialPageInfo = readProfileConnectionPageInfo(initialConnection);
  const resetKey = [
    kind,
    profileId ?? 'viewer',
    initialPageInfo.endCursor ?? '',
    initialPageInfo.hasNextPage ? 'next' : 'end',
  ].join(':');
  const resetKeyRef = useRef(resetKey);
  const requestSessionRef = useRef({ resetKey });

  // Change the session during render so a request from the previous connection
  // cannot commit in the gap before the reset effect runs.
  if (requestSessionRef.current.resetKey !== resetKey) {
    requestSessionRef.current = { resetKey };
  }

  const [extraRows, setExtraRows] = useState<ProfileConnectionUser[]>([]);
  const [pageInfo, setPageInfo] = useState(() => initialPageInfo);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const rows = appendProfileConnectionNodes(
    readConnectionNodes<ProfileConnectionUser>(initialConnection),
    extraRows,
  );

  useEffect(() => {
    if (resetKeyRef.current === resetKey) {
      return;
    }

    resetKeyRef.current = resetKey;
    setExtraRows([]);
    setPageInfo(initialPageInfo);
    setIsLoadingMore(false);
    setLoadMoreError(null);
  }, [initialPageInfo, resetKey]);

  async function loadMore() {
    if (isLoadingMore || !pageInfo.hasNextPage || pageInfo.endCursor == null) {
      return;
    }

    setIsLoadingMore(true);
    setLoadMoreError(null);
    const requestSession = requestSessionRef.current;

    try {
      const pageData = (await fetchQuery(
        relayEnvironment,
        config.query,
        profileId
          ? {
              ...PROFILE_CONNECTION_QUERY_VARIABLES,
              after: pageInfo.endCursor,
              id: profileId,
            }
          : {
              ...PROFILE_CONNECTION_QUERY_VARIABLES,
              after: pageInfo.endCursor,
            },
        { fetchPolicy: 'network-only' },
      ).toPromise()) as ProfileConnectionQueryData | null | undefined;

      if (requestSessionRef.current !== requestSession) {
        return;
      }

      const pageConnection = selectProfileConnection(pageData, kind);

      setExtraRows((current) =>
        appendProfileConnectionNodes(
          current,
          readConnectionNodes<ProfileConnectionUser>(pageConnection),
        ),
      );
      setPageInfo(readProfileConnectionPageInfo(pageConnection));
    } catch {
      if (requestSessionRef.current === requestSession) {
        setLoadMoreError('Could not load more profiles.');
      }
    } finally {
      if (requestSessionRef.current === requestSession) {
        setIsLoadingMore(false);
      }
    }
  }

  const renderConnectionRow = useCallback(
    ({ item: user }: ListRenderItemInfo<ProfileConnectionUser>) => (
      <View style={styles.section}>
        <ProfileConnectionRow
          onOpen={() =>
            router.push({
              params: { id: user.id },
              pathname: '/profiles/[id]',
            })
          }
          user={user}
        />
      </View>
    ),
    [router],
  );

  return (
    <FlatList
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      data={rows}
      keyExtractor={profileConnectionKeyExtractor}
      ListEmptyComponent={
        <View style={styles.section}>
          <ScreenState
            state="empty"
            message="No profiles are visible yet."
          />
        </View>
      }
      ListFooterComponent={
        pageInfo.hasNextPage && pageInfo.endCursor ? (
          <View style={styles.loadMorePanel}>
            <AppButton
              disabled={isLoadingMore}
              label={isLoadingMore ? 'Loading...' : 'Load more'}
              onPress={loadMore}
              variant="secondary"
            />
            {loadMoreError ? (
              <Text style={[styles.bodyText, { color: theme.colors.error }]}>
                {loadMoreError}
              </Text>
            ) : null}
          </View>
        ) : null
      }
      ListFooterComponentStyle={styles.section}
      ListHeaderComponent={
        <View style={styles.section}>
          <AppHeader
            eyebrow="Profile"
            title={config.title}
            subtitle={config.subtitle}
          />
        </View>
      }
      renderItem={renderConnectionRow}
      testID="profile-connection-list"
    />
  );
}

function profileConnectionKeyExtractor(user: ProfileConnectionUser): string {
  return user.id;
}

function ProfileConnectionRow({
  onOpen,
  user,
}: {
  onOpen: () => void;
  user: ProfileConnectionUser;
}) {
  const theme = useAppTheme();
  const label = user.email || 'LiveCanvas profile';

  return (
    <AppCard>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        onPress={onOpen}
        style={({ pressed }) => [
          styles.row,
          { borderColor: theme.colors.border, opacity: pressed ? 0.75 : 1 },
        ]}
      >
        <View style={styles.rowBody}>
          <Text style={[styles.rowTitle, { color: theme.colors.text }]}>
            {label}
          </Text>
          <Text style={[styles.bodyText, { color: theme.colors.textMuted }]}>
            {user.privacyMode === 'PRIVATE' ? 'Private' : 'Public'}
          </Text>
        </View>
      </Pressable>
    </AppCard>
  );
}

function profileConnectionConfig(kind: ProfileConnectionListKind) {
  switch (kind) {
    case 'viewerFollowers':
      return {
        query: viewerFollowersQuery,
        subtitle: 'People following you.',
        title: 'Followers',
      };

    case 'viewerFollowing':
      return {
        query: viewerFollowingQuery,
        subtitle: 'People you follow.',
        title: 'Following',
      };

    case 'otherFollowers':
      return {
        query: otherFollowersQuery,
        subtitle: 'Visible followers for this profile.',
        title: 'Followers',
      };

    case 'otherFollowing':
      return {
        query: otherFollowingQuery,
        subtitle: 'Visible following for this profile.',
        title: 'Following',
      };

    default:
      return kind satisfies never;
  }
}

function selectProfileConnection(
  data: ProfileConnectionQueryData | null | undefined,
  kind: ProfileConnectionListKind,
): UserConnection | null | undefined {
  switch (kind) {
    case 'viewerFollowers':
      return data?.viewer?.followers;

    case 'viewerFollowing':
      return data?.viewer?.following;

    case 'otherFollowers':
      return data?.node?.__typename === 'User' ? data.node.followers : null;

    case 'otherFollowing':
      return data?.node?.__typename === 'User' ? data.node.following : null;

    default:
      return kind satisfies never;
  }
}
