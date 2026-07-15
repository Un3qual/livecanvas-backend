import { memo } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { useAppTheme } from '../providers/ThemeProvider';
import { radius, spacing, touchTarget, typography } from '../theme/tokens';
import { ContentMediaAssetView } from './ContentMediaAssetView';
import {
  formatPostCardPresentation,
  type ContentPost,
} from './contentPostPresentation';
import {
  arePostControlViewStatesEqual,
  selectPostControlViewState,
} from './postControlViewState';
import {
  POST_OWNER_DELETE_CONFIRMATION,
  isViewerOwnedPost,
} from './postOwnerControlsState';
import type { PostControls } from './usePostControls';

export type { ContentPost } from './contentPostPresentation';

export type ContentPostCardProps = {
  readonly controls: PostControls;
  readonly onOpenAuthor: (authorId: string) => void;
  readonly onOpenStory?: (storyId: string) => void;
  readonly post: ContentPost;
  readonly viewerId: string | null;
};

const styles = StyleSheet.create({
  authorAction: {
    alignSelf: 'flex-start',
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: touchTarget.min,
  },
  authorActionPressed: {
    opacity: 0.7,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  badgeText: typography.label,
  bodyText: typography.body,
  cardHeader: {
    gap: spacing.xs,
  },
  editInput: {
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 88,
    padding: spacing.md,
    textAlignVertical: 'top',
  },
  editPanel: {
    gap: spacing.sm,
  },
  mediaList: {
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  metadata: {
    gap: spacing.xs,
  },
  metadataText: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  ownerControls: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  reportPanel: {
    gap: spacing.xs,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  visibilityControls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});

export const ContentPostCard = memo(function ContentPostCard({
  controls,
  onOpenAuthor,
  onOpenStory,
  post,
  viewerId,
}: ContentPostCardProps) {
  const theme = useAppTheme();
  const presentation = formatPostCardPresentation(post);
  const controlState = selectPostControlViewState(controls.state, post.id);
  const actions = controls.actions;
  const isOwnPost = isViewerOwnedPost(viewerId, post.author.id);
  const showReportAction = viewerId != null && !isOwnPost;
  const showOwnerControls = viewerId != null && isOwnPost;
  // The generic fallback title is shared, so include its opaque-ID subtitle to
  // keep adjacent author actions distinguishable to screen-reader users.
  const authorAccessibilityName = post.author.email?.trim()
    ? presentation.author.title
    : `${presentation.author.title}, ${presentation.author.subtitle}`;

  return (
    <AppCard>
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.badge,
            { backgroundColor: theme.colors.surfaceMuted },
          ]}
        >
          <Text style={[styles.badgeText, { color: theme.colors.text }]}>
            {presentation.kindLabel}
          </Text>
        </View>
        <Pressable
          accessibilityLabel={`Open author profile for ${authorAccessibilityName}`}
          accessibilityRole="button"
          onPress={() => onOpenAuthor(post.author.id)}
          style={({ pressed }) => [
            styles.authorAction,
            pressed ? styles.authorActionPressed : null,
          ]}
        >
          <Text style={[styles.title, { color: theme.colors.text }]}>
            {presentation.author.title}
          </Text>
          <Text style={[styles.metadataText, { color: theme.colors.textMuted }]}>
            {presentation.author.subtitle}
          </Text>
        </Pressable>
      </View>

      {controlState.isEditing && controlState.editState ? (
        <View style={styles.editPanel}>
          <TextInput
            accessibilityLabel="Post body"
            editable={!controlState.isOwnerActionPending}
            multiline
            onChangeText={actions.updateEditBody}
            style={[
              styles.editInput,
              {
                borderColor: theme.colors.border,
                color: theme.colors.text,
              },
            ]}
            value={controlState.editState.bodyText}
          />
          <View style={styles.visibilityControls}>
            <AppButton
              disabled={controlState.isOwnerActionPending}
              label="Followers"
              onPress={() => actions.selectEditVisibility('FOLLOWERS')}
              selected={controlState.editState.visibility === 'FOLLOWERS'}
              variant="secondary"
            />
            <AppButton
              disabled={controlState.isOwnerActionPending}
              label="Public"
              onPress={() => actions.selectEditVisibility('PUBLIC')}
              selected={controlState.editState.visibility === 'PUBLIC'}
              variant="secondary"
            />
          </View>
          <View style={styles.ownerControls}>
            <AppButton
              disabled={controlState.isOwnerActionPending}
              label={controlState.isUpdating ? 'Saving...' : 'Save post'}
              onPress={() => actions.saveEdit(post)}
            />
            <AppButton
              disabled={controlState.isOwnerActionPending}
              label="Cancel"
              onPress={actions.cancelEdit}
              variant="secondary"
            />
          </View>
        </View>
      ) : (
        <Text style={[styles.bodyText, { color: theme.colors.text }]}>
          {presentation.body}
        </Text>
      )}

      <View style={styles.metadata}>
        <Text style={[styles.metadataText, { color: theme.colors.textMuted }]}>
          {presentation.timestampLabel}
        </Text>
        <Text style={[styles.metadataText, { color: theme.colors.textMuted }]}>
          {presentation.visibilityLabel}
        </Text>
        {presentation.storyExpiryLabel ? (
          <Text style={[styles.metadataText, { color: theme.colors.textMuted }]}>
            {presentation.storyExpiryLabel}
          </Text>
        ) : null}
      </View>

      {presentation.mediaAssets.length > 0 ? (
        <View
          style={[
            styles.mediaList,
            {
              backgroundColor: theme.colors.surfaceMuted,
              borderColor: theme.colors.border,
            },
          ]}
        >
          {presentation.mediaAssets.map((asset) => (
            <ContentMediaAssetView asset={asset} key={asset.id} />
          ))}
        </View>
      ) : null}

      {onOpenStory ? (
        <AppButton
          label="View story"
          onPress={() => onOpenStory(post.id)}
          variant="secondary"
        />
      ) : null}

      {showReportAction ? (
        <View style={styles.reportPanel}>
          {controlState.isReportConfirmed ? (
            <Text style={[styles.metadataText, { color: theme.colors.text }]}>
              Report submitted.
            </Text>
          ) : (
            <AppButton
              disabled={controlState.isReportPending}
              label={
                controlState.isReportActive ? 'Reporting...' : 'Report post'
              }
              onPress={() => actions.reportPost(post)}
              variant="secondary"
            />
          )}

          {controlState.reportError ? (
            <Text style={[styles.metadataText, { color: theme.colors.error }]}>
              {controlState.reportError}
            </Text>
          ) : null}
        </View>
      ) : null}

      {showOwnerControls ? (
        <View style={styles.reportPanel}>
          {controlState.isConfirmingDelete ? (
            <>
              <Text style={[styles.metadataText, { color: theme.colors.text }]}>
                {POST_OWNER_DELETE_CONFIRMATION}
              </Text>
              <View style={styles.ownerControls}>
                <AppButton
                  disabled={controlState.isOwnerActionPending}
                  label={
                    controlState.isDeleting
                      ? 'Deleting...'
                      : 'Confirm delete'
                  }
                  onPress={() => actions.confirmDelete(post)}
                />
                <AppButton
                  disabled={controlState.isOwnerActionPending}
                  label="Cancel"
                  onPress={actions.cancelDelete}
                  variant="secondary"
                />
              </View>
            </>
          ) : controlState.isEditing ? null : (
            <View style={styles.ownerControls}>
              <AppButton
                disabled={controlState.isOwnerActionPending}
                label="Edit post"
                onPress={() => actions.startEdit(post)}
                variant="secondary"
              />
              <AppButton
                disabled={controlState.isOwnerActionPending}
                label="Delete post"
                onPress={() => actions.deletePost(post)}
                variant="secondary"
              />
            </View>
          )}

          {controlState.ownerError ? (
            <Text style={[styles.metadataText, { color: theme.colors.error }]}>
              {controlState.ownerError}
            </Text>
          ) : null}
        </View>
      ) : null}
    </AppCard>
  );
}, areContentPostCardPropsEqual);

function areContentPostCardPropsEqual(
  previous: ContentPostCardProps,
  next: ContentPostCardProps,
): boolean {
  if (
    previous.post !== next.post ||
    previous.onOpenAuthor !== next.onOpenAuthor ||
    previous.onOpenStory !== next.onOpenStory ||
    previous.viewerId !== next.viewerId ||
    previous.controls.actions !== next.controls.actions
  ) {
    return false;
  }

  return arePostControlViewStatesEqual(
    selectPostControlViewState(previous.controls.state, previous.post.id),
    selectPostControlViewState(next.controls.state, next.post.id),
  );
}
