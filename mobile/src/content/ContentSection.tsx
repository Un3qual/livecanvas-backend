import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import {
  LiveSessionSummaryCard,
  type LiveSessionSummary,
} from '../live/components/LiveSessionSummaryCard';
import { useAppTheme } from '../providers/ThemeProvider';
import { spacing, typography } from '../theme/tokens';
import { ContentPostCard, type ContentPost } from './ContentPostCard';
import type { PostControls } from './usePostControls';

export type ContentSectionLoadMore = {
  readonly error: string | null;
  readonly isLoading: boolean;
  readonly onLoadMore: () => void;
  readonly visible: boolean;
};

type ContentSectionBaseProps = {
  readonly emptyMessage: string;
  readonly loadMore?: ContentSectionLoadMore;
  readonly onViewAll?: () => void;
  readonly title: string;
};

type ContentPostSectionProps = ContentSectionBaseProps & {
  readonly kind: 'posts' | 'stories';
  readonly postControls: PostControls;
  readonly posts: ReadonlyArray<ContentPost>;
  readonly viewerId: string | null;
};

type ContentSessionSectionProps = ContentSectionBaseProps & {
  readonly kind: 'live' | 'replays';
  readonly onOpenLiveSession: (sessionId: string) => void;
  readonly sessions: ReadonlyArray<LiveSessionSummary>;
};

export type ContentSectionProps =
  | ContentPostSectionProps
  | ContentSessionSectionProps;

const styles = StyleSheet.create({
  bodyText: typography.body,
  loadMorePanel: {
    gap: spacing.xs,
  },
  section: {
    gap: spacing.sm,
    maxWidth: 420,
    width: '100%',
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  sectionTitle: typography.label,
});

export function ContentSection(props: ContentSectionProps) {
  const theme = useAppTheme();
  const isEmpty =
    'posts' in props ? props.posts.length === 0 : props.sessions.length === 0;

  return (
    <View style={styles.section} testID={`content-section-${props.kind}`}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          {props.title}
        </Text>
        {props.onViewAll ? (
          <AppButton
            label="View all"
            onPress={props.onViewAll}
            variant="secondary"
          />
        ) : null}
      </View>

      {isEmpty ? (
        <AppCard>
          <Text style={[styles.bodyText, { color: theme.colors.textMuted }]}>
            {props.emptyMessage}
          </Text>
        </AppCard>
      ) : (
        <ContentSectionRows {...props} />
      )}

      <ContentSectionLoadMoreControl kind={props.kind} loadMore={props.loadMore} />
    </View>
  );
}

function ContentSectionRows(props: ContentSectionProps) {
  switch (props.kind) {
    case 'posts':
    case 'stories':
      return props.posts.map((post) => (
        <ContentPostCard
          controls={props.postControls}
          key={post.id}
          post={post}
          viewerId={props.viewerId}
        />
      ));

    case 'live':
    case 'replays': {
      const buttonLabel = props.kind === 'live' ? 'Watch live' : 'Watch replay';

      return props.sessions.map((session) => (
        <LiveSessionSummaryCard
          buttonLabel={buttonLabel}
          key={session.id}
          onPress={() => props.onOpenLiveSession(session.id)}
          session={session}
        />
      ));
    }

    default:
      return assertNever(props);
  }
}

function ContentSectionLoadMoreControl({
  kind,
  loadMore,
}: {
  readonly kind: ContentSectionProps['kind'];
  readonly loadMore?: ContentSectionLoadMore;
}) {
  const theme = useAppTheme();

  if (!loadMore?.visible) {
    return null;
  }

  return (
    <View style={styles.loadMorePanel}>
      <AppButton
        disabled={loadMore.isLoading}
        label={loadMore.isLoading ? 'Loading...' : loadMoreLabel(kind)}
        onPress={loadMore.onLoadMore}
        variant="secondary"
      />
      {loadMore.error ? (
        <Text style={[styles.bodyText, { color: theme.colors.error }]}>
          {loadMore.error}
        </Text>
      ) : null}
    </View>
  );
}

function loadMoreLabel(kind: ContentSectionProps['kind']): string {
  switch (kind) {
    case 'posts':
      return 'Load more feed posts';

    case 'stories':
      return 'Load more stories';

    case 'live':
      return 'Load more live sessions';

    case 'replays':
      return 'Load more replays';

    default:
      return assertNever(kind);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled content section variant: ${String(value)}`);
}
