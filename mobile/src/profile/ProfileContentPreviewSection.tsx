import React, {
  Suspense,
  useReducer,
  type PropsWithChildren,
} from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useLazyLoadQuery } from 'react-relay';

import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import type { ContentPost } from '../content/ContentPostCard';
import { ContentSection } from '../content/ContentSection';
import type { ProfileContentKind } from '../content/contentSurfaceTypes';
import { usePostControls } from '../content/usePostControls';
import {
  type LiveSessionSummary,
} from '../live/components/LiveSessionSummaryCard';
import { liveSessionHref } from '../live/liveSessionNavigation';
import { useAppTheme } from '../providers/ThemeProvider';
import { readConnectionNodes } from '../relay/readConnectionNodes';
import { spacing, typography } from '../theme/tokens';
import {
  profileContentQuery,
  profileContentVariables,
  selectProfileContentConnection,
  type ProfileContentQuery,
} from './profileContentOperations';
import {
  profileContentHref,
  type ProfileContentScope,
} from './profileContentRouteParams';

type ProfileContentPreviewSectionProps = {
  readonly kind: ProfileContentKind;
  readonly profileId: string;
  readonly scope: ProfileContentScope;
};

const styles = StyleSheet.create({
  state: {
    gap: spacing.sm,
    maxWidth: 420,
    width: '100%',
  },
  stateText: typography.body,
});

export function ProfileContentPreviewSection(
  props: ProfileContentPreviewSectionProps,
) {
  const [retryKey, retry] = useReducer((key: number) => key + 1, 0);
  const resetKey = `${props.profileId}:${props.kind}:${retryKey}`;

  return (
    <ProfileContentPreviewErrorBoundary
      key={resetKey}
      kind={props.kind}
      onRetry={retry}
    >
      <Suspense fallback={<ProfileContentPreviewLoading kind={props.kind} />}>
        <ProfileContentPreviewContent {...props} key={resetKey} />
      </Suspense>
    </ProfileContentPreviewErrorBoundary>
  );
}

function ProfileContentPreviewContent({
  kind,
  profileId,
  scope,
}: ProfileContentPreviewSectionProps) {
  const router = useRouter();
  const data = useLazyLoadQuery<ProfileContentQuery>(
    profileContentQuery,
    profileContentVariables(profileId, kind, 3, null),
    { fetchPolicy: 'store-and-network' },
  );
  const viewerId = data.viewer?.id ?? null;
  const postControls = usePostControls({ viewerId });
  const copy = previewCopy(kind);
  const onViewAll = () => {
    router.push(profileContentHref(profileId, kind, scope));
  };

  switch (kind) {
    case 'posts':
    case 'stories':
      return (
        <ContentSection
          emptyMessage={copy.emptyMessage}
          kind={kind}
          onViewAll={onViewAll}
          postControls={postControls}
          posts={readConnectionNodes<ContentPost>(
            selectProfileContentConnection(data, kind),
          )}
          title={copy.title}
          viewerId={viewerId}
        />
      );

    case 'replays':
      return (
        <ContentSection
          emptyMessage={copy.emptyMessage}
          kind="replays"
          onOpenLiveSession={(sessionId) => {
            router.push(liveSessionHref(sessionId));
          }}
          onViewAll={onViewAll}
          sessions={readConnectionNodes<LiveSessionSummary>(
            selectProfileContentConnection(data, kind),
          )}
          title={copy.title}
        />
      );

    default:
      return assertNever(kind);
  }
}

type ProfileContentPreviewErrorBoundaryProps = PropsWithChildren<{
  readonly kind: ProfileContentKind;
  readonly onRetry: () => void;
}>;

type ProfileContentPreviewErrorBoundaryState = {
  readonly hasError: boolean;
};

class ProfileContentPreviewErrorBoundary extends React.Component<
  ProfileContentPreviewErrorBoundaryProps,
  ProfileContentPreviewErrorBoundaryState
> {
  state: ProfileContentPreviewErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ProfileContentPreviewErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <ProfileContentPreviewState
        actionLabel={`Retry ${contentLabel(this.props.kind)}`}
        message={`Could not load ${contentLabel(this.props.kind)}.`}
        onAction={this.props.onRetry}
      />
    );
  }
}

function ProfileContentPreviewLoading({ kind }: { kind: ProfileContentKind }) {
  return (
    <ProfileContentPreviewState
      message={`Loading ${contentLabel(kind)}...`}
    />
  );
}

function ProfileContentPreviewState({
  actionLabel,
  message,
  onAction,
}: {
  readonly actionLabel?: string;
  readonly message: string;
  readonly onAction?: () => void;
}) {
  const theme = useAppTheme();

  return (
    <View style={styles.state}>
      <AppCard>
        <Text style={[styles.stateText, { color: theme.colors.textMuted }]}>
          {message}
        </Text>
        {actionLabel && onAction ? (
          <AppButton
            label={actionLabel}
            onPress={onAction}
            variant="secondary"
          />
        ) : null}
      </AppCard>
    </View>
  );
}

function previewCopy(kind: ProfileContentKind): {
  readonly emptyMessage: string;
  readonly title: string;
} {
  switch (kind) {
    case 'posts':
      return { emptyMessage: 'No visible posts yet.', title: 'Posts' };

    case 'stories':
      return { emptyMessage: 'No active stories yet.', title: 'Stories' };

    case 'replays':
      return { emptyMessage: 'No visible replays yet.', title: 'Replays' };

    default:
      return assertNever(kind);
  }
}

function contentLabel(kind: ProfileContentKind): string {
  return kind;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled profile content preview kind: ${String(value)}`);
}
