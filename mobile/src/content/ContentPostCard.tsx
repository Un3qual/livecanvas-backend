import { StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import {
  formatPostCardPresentation,
  type ContentMediaAssetPresentation,
  type ContentPost,
} from './contentPostPresentation';
import {
  POST_OWNER_DELETE_CONFIRMATION,
  isViewerOwnedPost,
} from './postOwnerControlsState';
import { isPostReportConfirmed } from './reportPostReducer';
import { useAppTheme } from '../providers/ThemeProvider';
import { radius, spacing, typography } from '../theme/tokens';
import type { PostControls } from './usePostControls';

export type { ContentPost } from './contentPostPresentation';

export type ContentPostCardProps = {
  readonly controls: PostControls;
  readonly post: ContentPost;
  readonly viewerId: string | null;
};

const styles = StyleSheet.create({
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

export function ContentPostCard({
  controls,
  post,
  viewerId,
}: ContentPostCardProps) {
  const theme = useAppTheme();
  const presentation = formatPostCardPresentation(post);
  const isOwnPost = isViewerOwnedPost(viewerId, post.author.id);
  const isReportActive = controls.reportState.activePostId === post.id;
  const isReportConfirmed = isPostReportConfirmed(
    controls.reportState,
    post.id,
  );
  const reportError = controls.reportState.errorsByPostId[post.id] ?? null;
  const ownerError = controls.errorsByPostId[post.id] ?? null;
  const showReportAction = viewerId != null && !isOwnPost;
  const showOwnerControls = viewerId != null && isOwnPost;
  const isEditing = controls.editingPostId === post.id;
  const isConfirmingDelete = controls.deleteConfirmationPostId === post.id;
  const isUpdating =
    controls.pendingAction?.kind === 'update' &&
    controls.pendingAction.postId === post.id;
  const isDeleting =
    controls.pendingAction?.kind === 'delete' &&
    controls.pendingAction.postId === post.id;
  const isOwnerActionPending = controls.pendingAction !== null;

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
        <Text style={[styles.title, { color: theme.colors.text }]}>
          {presentation.author.title}
        </Text>
        <Text style={[styles.metadataText, { color: theme.colors.textMuted }]}>
          {presentation.author.subtitle}
        </Text>
      </View>

      {isEditing && controls.editState ? (
        <View style={styles.editPanel}>
          <TextInput
            accessibilityLabel="Post body"
            editable={!isOwnerActionPending}
            multiline
            onChangeText={controls.updateEditBody}
            style={[
              styles.editInput,
              {
                borderColor: theme.colors.border,
                color: theme.colors.text,
              },
            ]}
            value={controls.editState.bodyText}
          />
          <View style={styles.visibilityControls}>
            <AppButton
              disabled={isOwnerActionPending}
              label="Followers"
              onPress={() => controls.selectEditVisibility('FOLLOWERS')}
              selected={controls.editState.visibility === 'FOLLOWERS'}
              variant="secondary"
            />
            <AppButton
              disabled={isOwnerActionPending}
              label="Public"
              onPress={() => controls.selectEditVisibility('PUBLIC')}
              selected={controls.editState.visibility === 'PUBLIC'}
              variant="secondary"
            />
          </View>
          <View style={styles.ownerControls}>
            <AppButton
              disabled={isOwnerActionPending}
              label={isUpdating ? 'Saving...' : 'Save post'}
              onPress={() => controls.saveEdit(post)}
            />
            <AppButton
              disabled={isOwnerActionPending}
              label="Cancel"
              onPress={controls.cancelEdit}
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
            <MediaAssetRow asset={asset} key={asset.id} />
          ))}
        </View>
      ) : null}

      {showReportAction ? (
        <View style={styles.reportPanel}>
          {isReportConfirmed ? (
            <Text style={[styles.metadataText, { color: theme.colors.text }]}>
              Report submitted.
            </Text>
          ) : (
            <AppButton
              disabled={isReportActive}
              label={isReportActive ? 'Reporting...' : 'Report post'}
              onPress={() => controls.reportPost(post)}
              variant="secondary"
            />
          )}

          {reportError ? (
            <Text style={[styles.metadataText, { color: theme.colors.error }]}>
              {reportError}
            </Text>
          ) : null}
        </View>
      ) : null}

      {showOwnerControls ? (
        <View style={styles.reportPanel}>
          {isConfirmingDelete ? (
            <>
              <Text style={[styles.metadataText, { color: theme.colors.text }]}>
                {POST_OWNER_DELETE_CONFIRMATION}
              </Text>
              <View style={styles.ownerControls}>
                <AppButton
                  disabled={isOwnerActionPending}
                  label={isDeleting ? 'Deleting...' : 'Confirm delete'}
                  onPress={() => controls.confirmDelete(post)}
                />
                <AppButton
                  disabled={isOwnerActionPending}
                  label="Cancel"
                  onPress={controls.cancelDelete}
                  variant="secondary"
                />
              </View>
            </>
          ) : isEditing ? null : (
            <View style={styles.ownerControls}>
              <AppButton
                disabled={isOwnerActionPending}
                label="Edit post"
                onPress={() => controls.startEdit(post)}
                variant="secondary"
              />
              <AppButton
                disabled={isOwnerActionPending}
                label="Delete post"
                onPress={() => controls.deletePost(post)}
                variant="secondary"
              />
            </View>
          )}

          {ownerError ? (
            <Text style={[styles.metadataText, { color: theme.colors.error }]}>
              {ownerError}
            </Text>
          ) : null}
        </View>
      ) : null}
    </AppCard>
  );
}

function MediaAssetRow({ asset }: { asset: ContentMediaAssetPresentation }) {
  const theme = useAppTheme();

  return (
    <View>
      <Text style={[styles.metadataText, { color: theme.colors.text }]}>
        {asset.label}
      </Text>
      <Text style={[styles.metadataText, { color: theme.colors.textMuted }]}>
        {asset.body}
      </Text>
    </View>
  );
}
