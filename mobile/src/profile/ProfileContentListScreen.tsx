import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
} from 'react';
import { useRouter } from 'expo-router';
import {
  FlatList,
  StyleSheet,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import {
  fetchQuery,
  useLazyLoadQuery,
  useRelayEnvironment,
} from 'react-relay';

import { AppHeader } from '../components/AppHeader';
import { ScreenState } from '../components/ScreenState';
import { ContentPostCard, type ContentPost } from '../content/ContentPostCard';
import { ContentSectionLoadMoreControl } from '../content/ContentSection';
import {
  contentConnectionReducer,
  createContentConnectionState,
  selectContentRows,
} from '../content/contentConnectionState';
import type {
  ContentPageInfo,
  ContentRequestIdentity,
  ProfileContentKind,
} from '../content/contentSurfaceTypes';
import { applyContentPostChanges } from '../content/contentPostChanges';
import { usePostControls } from '../content/usePostControls';
import {
  LiveSessionSummaryCard,
  type LiveSessionSummary,
} from '../live/components/LiveSessionSummaryCard';
import { liveSessionHref } from '../live/liveSessionNavigation';
import { useAppTheme } from '../providers/ThemeProvider';
import { readConnectionNodes } from '../relay/readConnectionNodes';
import { spacing } from '../theme/tokens';
import {
  profileContentQuery,
  profileContentVariables,
  selectProfileContentConnection,
  type ProfileContentData,
  type ProfileContentQuery,
} from './profileContentOperations';

type ProfileContentRow = ContentPost | LiveSessionSummary;

type ProfileContentRouteGeneration = {
  readonly key: string;
  readonly value: number;
};

const PROFILE_CONTENT_PAGE_SIZE = 10;

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
  },
  screen: {
    flex: 1,
  },
  section: {
    gap: spacing.sm,
    maxWidth: 420,
    width: '100%',
  },
});

export function ProfileContentListScreen({
  kind,
  profileId,
}: {
  readonly kind: ProfileContentKind;
  readonly profileId: string;
}) {
  const data = useLazyLoadQuery<ProfileContentQuery>(
    profileContentQuery,
    profileContentVariables(profileId, kind, PROFILE_CONTENT_PAGE_SIZE, null),
    { fetchPolicy: 'store-and-network' },
  );
  const baseRows = selectProfileContentRows(data, kind);
  const pageInfo = selectProfileContentPageInfo(data, kind);
  const basePageIdentity = createProfileContentBaseIdentity(baseRows, pageInfo);
  const routeKey = `${profileId}:${kind}:${basePageIdentity}`;
  const routeGenerationRef = useRef<ProfileContentRouteGeneration>({
    key: routeKey,
    value: 1,
  });

  // Advance during render so an A -> B -> A navigation invalidates the first
  // A before any layout/effect cleanup from that generation can race it.
  if (routeGenerationRef.current.key !== routeKey) {
    routeGenerationRef.current = {
      key: routeKey,
      value: routeGenerationRef.current.value + 1,
    };
  }

  const routeGeneration = routeGenerationRef.current.value;

  return (
    <ProfileContentListConnection
      basePageIdentity={basePageIdentity}
      baseRows={baseRows}
      key={routeGeneration}
      kind={kind}
      pageInfo={pageInfo}
      profileId={profileId}
      routeGeneration={routeGeneration}
      viewerId={data.viewer?.id ?? null}
    />
  );
}

function ProfileContentListConnection({
  basePageIdentity,
  baseRows,
  kind,
  pageInfo,
  profileId,
  routeGeneration,
  viewerId,
}: {
  readonly basePageIdentity: string;
  readonly baseRows: ReadonlyArray<ProfileContentRow>;
  readonly kind: ProfileContentKind;
  readonly pageInfo: ContentPageInfo;
  readonly profileId: string;
  readonly routeGeneration: number;
  readonly viewerId: string | null;
}) {
  const theme = useAppTheme();
  const router = useRouter();
  const relayEnvironment = useRelayEnvironment();
  const postControls = usePostControls({ viewerId });
  const isActiveGenerationRef = useRef(true);
  const activeRequestRef = useRef<ContentRequestIdentity | null>(null);
  const requestIdRef = useRef(0);
  const [connectionState, dispatchConnection] = useReducer(
    contentConnectionReducer<ProfileContentRow>,
    {
      basePageIdentity,
      baseRows,
      pageInfo,
      routeGeneration,
    },
    createContentConnectionState,
  );

  useLayoutEffect(() => {
    isActiveGenerationRef.current = true;

    return () => {
      isActiveGenerationRef.current = false;
      activeRequestRef.current = null;
    };
  }, []);

  useEffect(() => {
    dispatchConnection({
      basePageIdentity,
      baseRows,
      pageInfo,
      routeGeneration,
      type: 'replace_base',
    });
  }, [basePageIdentity, baseRows, pageInfo, routeGeneration]);

  const contentRows = selectContentRows(connectionState);
  const rows =
    kind === 'posts' || kind === 'stories'
      ? applyContentPostChanges(
          contentRows.filter(isContentPost),
          postControls.changes,
        )
      : contentRows.filter(isLiveSessionSummary);
  const copy = profileContentListCopy(kind);

  async function loadMore() {
    const cursor = connectionState.pageInfo.endCursor;

    if (
      cursor == null ||
      !connectionState.pageInfo.hasNextPage ||
      connectionState.activeRequest !== null ||
      activeRequestRef.current !== null
    ) {
      return;
    }

    const request = {
      cursor,
      key: `${profileId}:${kind}:${cursor}:${requestIdRef.current + 1}`,
      routeGeneration,
    };
    requestIdRef.current += 1;
    activeRequestRef.current = request;
    dispatchConnection({ request, type: 'load_more_start' });

    try {
      const pageData = await fetchQuery<ProfileContentQuery>(
        relayEnvironment,
        profileContentQuery,
        profileContentVariables(
          profileId,
          kind,
          PROFILE_CONTENT_PAGE_SIZE,
          cursor,
        ),
        { fetchPolicy: 'network-only' },
      ).toPromise();

      if (
        !isActiveGenerationRef.current ||
        activeRequestRef.current !== request
      ) {
        return;
      }

      dispatchConnection({
        pageInfo: selectProfileContentPageInfo(pageData, kind),
        request,
        rows: selectProfileContentRows(pageData, kind),
        type: 'load_more_success',
      });
    } catch {
      if (
        !isActiveGenerationRef.current ||
        activeRequestRef.current !== request
      ) {
        return;
      }

      dispatchConnection({
        message: `Could not load more ${kind}.`,
        request,
        type: 'load_more_error',
      });
    } finally {
      if (activeRequestRef.current === request) {
        activeRequestRef.current = null;
      }
    }
  }

  const renderRow = useCallback(
    ({ item }: ListRenderItemInfo<ProfileContentRow>) => {
      if (kind === 'replays' && isLiveSessionSummary(item)) {
        return (
          <View style={styles.section}>
            <LiveSessionSummaryCard
              buttonLabel="Watch replay"
              onPress={() => router.push(liveSessionHref(item.id))}
              session={item}
            />
          </View>
        );
      }

      if (kind !== 'replays' && isContentPost(item)) {
        return (
          <View style={styles.section}>
            <ContentPostCard
              controls={postControls}
              post={item}
              viewerId={viewerId}
            />
          </View>
        );
      }

      return null;
    },
    [kind, postControls, router, viewerId],
  );

  return (
    <FlatList
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      data={rows}
      keyExtractor={profileContentKeyExtractor}
      ListEmptyComponent={
        <View style={styles.section}>
          <ScreenState state="empty" message={copy.emptyMessage} />
        </View>
      }
      ListFooterComponent={
        <ContentSectionLoadMoreControl
          kind={kind}
          loadMore={{
            error: connectionState.error,
            isLoading: connectionState.activeRequest !== null,
            onLoadMore: () => {
              void loadMore();
            },
            visible:
              connectionState.pageInfo.hasNextPage &&
              connectionState.pageInfo.endCursor !== null,
          }}
        />
      }
      ListFooterComponentStyle={styles.section}
      ListHeaderComponent={
        <View style={styles.section}>
          <AppHeader
            eyebrow="Profile"
            subtitle={copy.subtitle}
            title={copy.title}
          />
        </View>
      }
      renderItem={renderRow}
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
      testID="profile-content-list"
    />
  );
}

function selectProfileContentRows(
  data: ProfileContentData | null | undefined,
  kind: ProfileContentKind,
): ProfileContentRow[] {
  if (!data) {
    return [];
  }

  switch (kind) {
    case 'posts':
    case 'stories':
      return readConnectionNodes<ContentPost>(
        selectProfileContentConnection(data, kind),
      );

    case 'replays':
      return readConnectionNodes<LiveSessionSummary>(
        selectProfileContentConnection(data, kind),
      );

    default:
      return assertNever(kind);
  }
}

function selectProfileContentPageInfo(
  data: ProfileContentData | null | undefined,
  kind: ProfileContentKind,
): ContentPageInfo {
  if (!data) {
    return { endCursor: null, hasNextPage: false };
  }

  const connection = selectConnectionForPageInfo(data, kind);

  return {
    endCursor: connection?.pageInfo.endCursor ?? null,
    hasNextPage: connection?.pageInfo.hasNextPage ?? false,
  };
}

function selectConnectionForPageInfo(
  data: ProfileContentData,
  kind: ProfileContentKind,
) {
  switch (kind) {
    case 'posts':
    case 'stories':
      return selectProfileContentConnection(data, kind);

    case 'replays':
      return selectProfileContentConnection(data, kind);

    default:
      return assertNever(kind);
  }
}

function createProfileContentBaseIdentity(
  rows: ReadonlyArray<ProfileContentRow>,
  pageInfo: ContentPageInfo,
): string {
  return JSON.stringify({
    endCursor: pageInfo.endCursor,
    hasNextPage: pageInfo.hasNextPage,
    ids: rows.map((row) => row.id),
  });
}

function profileContentKeyExtractor(row: ProfileContentRow): string {
  return row.id;
}

function isContentPost(row: ProfileContentRow): row is ContentPost {
  return 'author' in row;
}

function isLiveSessionSummary(
  row: ProfileContentRow,
): row is LiveSessionSummary {
  return 'host' in row;
}

function profileContentListCopy(kind: ProfileContentKind): {
  readonly emptyMessage: string;
  readonly subtitle: string;
  readonly title: string;
} {
  switch (kind) {
    case 'posts':
      return {
        emptyMessage: 'No visible posts yet.',
        subtitle: 'Posts visible on this profile.',
        title: 'Posts',
      };

    case 'stories':
      return {
        emptyMessage: 'No active stories yet.',
        subtitle: 'Active stories visible on this profile.',
        title: 'Stories',
      };

    case 'replays':
      return {
        emptyMessage: 'No visible replays yet.',
        subtitle: 'Replays visible on this profile.',
        title: 'Replays',
      };

    default:
      return assertNever(kind);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled profile content list kind: ${String(value)}`);
}
