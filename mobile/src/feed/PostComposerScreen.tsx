import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useMutation } from 'react-relay';

import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { AppHeader } from '../components/AppHeader';
import type { MediaPostPublishingState } from '../content/mediaPostPublishingState';
import type { PickedPostMedia } from '../content/mediaPostSelection';
import { useAppTheme } from '../providers/ThemeProvider';
import { radius, spacing, typography } from '../theme/tokens';
import {
  POST_COMPOSER_BODY_TEXT_MAX_LENGTH,
  POST_COMPOSER_KINDS,
  POST_COMPOSER_VISIBILITIES,
  buildCreatePostInput,
  canSubmitPostComposer,
  countPostComposerBodyTextCharacters,
  createPostComposerState,
  formatCreatePostMutationErrors,
  getPostComposerValidationMessage,
  selectPostComposerKind,
  selectPostComposerVisibility,
  updatePostComposerBody,
  type PostComposerKind,
  type PostComposerVisibility,
} from '../content/postComposerState';
import { useMediaPostPublishing } from '../content/useMediaPostPublishing';
import {
  postComposerCreatePostMutation,
  type PostComposerCreatePostMutation,
  usePostComposerMediaPublishingDependencies,
} from './postComposerOperations';

const POST_COMPOSER_KIND_LABELS: Record<PostComposerKind, string> = {
  STANDARD: 'Standard',
  STORY: 'Story',
};

const POST_COMPOSER_VISIBILITY_LABELS: Record<PostComposerVisibility, string> =
  {
    FOLLOWERS: 'Followers',
    PUBLIC: 'Public',
  };

type PostComposerRouter = ReturnType<typeof useRouter> & {
  canGoBack?: () => boolean;
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
  card: {
    gap: spacing.md,
  },
  fieldGroup: {
    gap: spacing.sm,
  },
  label: typography.label,
  input: {
    minHeight: 160,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    padding: spacing.md,
    textAlignVertical: 'top',
    ...typography.body,
  },
  counter: {
    ...typography.label,
    alignSelf: 'flex-end',
    fontVariant: ['tabular-nums'],
  },
  validation: typography.body,
  mediaPanel: {
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  mediaSummary: typography.body,
  segmentedGroup: {
    gap: spacing.sm,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'flex-end',
  },
});

export function PostComposerScreen() {
  const router = useRouter() as PostComposerRouter;
  const theme = useAppTheme();
  const isMountedRef = useRef(true);
  const activeCreatePostRef = useRef(false);
  const activeMediaSubmitRef = useRef(false);
  const handledMediaSuccessRef = useRef<number | null>(null);
  const [state, setState] = useState(() => createPostComposerState());
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [bodyBlurred, setBodyBlurred] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const mediaDependencies = usePostComposerMediaPublishingDependencies();
  const {
    cancel: cancelMedia,
    removeMedia,
    retryMedia,
    selectMedia,
    state: mediaState,
    submit: submitMedia,
  } = useMediaPostPublishing({ dependencies: mediaDependencies });
  const [commitCreatePost, isCreatePostInFlight] =
    useMutation<PostComposerCreatePostMutation>(
      postComposerCreatePostMutation,
    );
  const trimmedBodyLength = countPostComposerBodyTextCharacters(
    state.bodyText.trim(),
  );
  const hasReadyMedia = mediaState.stage === 'ready';
  const validationMessage = getPostComposerValidationMessage(
    state,
    hasReadyMedia,
  );
  const canSubmit =
    canSubmitPostComposer(state, hasReadyMedia) &&
    !isMediaPreparationBlocking(mediaState.stage);
  const isSubmitting = isPostSubmissionActive();
  const shouldShowValidation =
    validationMessage !== null &&
    (submitAttempted ||
      bodyBlurred ||
      trimmedBodyLength > POST_COMPOSER_BODY_TEXT_MAX_LENGTH);
  const visibleMessage =
    state.errorMessage ?? (shouldShowValidation ? validationMessage : null);

  useEffect(
    () => () => {
      isMountedRef.current = false;
      activeCreatePostRef.current = false;
      activeMediaSubmitRef.current = false;
    },
    [],
  );

  useEffect(() => {
    if (mediaState.stage !== 'submitting') {
      activeMediaSubmitRef.current = false;
    }

    if (
      mediaState.stage !== 'succeeded' ||
      handledMediaSuccessRef.current === mediaState.attemptId
    ) {
      return;
    }

    handledMediaSuccessRef.current = mediaState.attemptId;
    setState(createPostComposerState());
    setSubmitAttempted(false);
    setBodyBlurred(false);
    setSuccessMessage('Post created.');
    removeMedia();
    router.replace('/home');
  }, [mediaState.attemptId, mediaState.stage, removeMedia, router]);

  function handleSubmit() {
    if (isPostSubmissionActive()) {
      return;
    }

    const input = buildCreatePostInput(state, hasReadyMedia);

    if (input === null) {
      setSubmitAttempted(true);
      return;
    }

    setSubmitAttempted(true);
    setSuccessMessage(null);

    if (hasReadyMedia) {
      activeMediaSubmitRef.current = true;
      submitMedia(input);
      return;
    }

    activeCreatePostRef.current = true;
    commitCreatePost({
      variables: { input },
      onCompleted: (payload) => {
        if (!isMountedRef.current) {
          activeCreatePostRef.current = false;
          return;
        }

        activeCreatePostRef.current = false;
        const result = payload.createPost;

        if (!result?.post || result.errors.length > 0) {
          setState((current) => ({
            ...current,
            errorMessage: formatCreatePostMutationErrors(result?.errors),
          }));
          return;
        }

        setState(createPostComposerState());
        setSubmitAttempted(false);
        setBodyBlurred(false);
        setSuccessMessage('Post created.');
        router.replace('/home');
      },
      onError: () => {
        if (!isMountedRef.current) {
          activeCreatePostRef.current = false;
          return;
        }

        activeCreatePostRef.current = false;
        setState((current) => ({
          ...current,
          errorMessage: formatCreatePostMutationErrors(null),
        }));
      },
    });
  }

  function handleCancel() {
    if (isPostSubmissionActive()) {
      return;
    }

    if (router.canGoBack?.()) {
      router.back();
      return;
    }

    router.replace('/home');
  }

  function isPostSubmissionActive() {
    return (
      isCreatePostInFlight ||
      activeCreatePostRef.current ||
      activeMediaSubmitRef.current ||
      mediaState.stage === 'submitting'
    );
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
    >
      <AppHeader
        eyebrow="Create"
        title="Compose post"
        subtitle="Share text, a photo, or a video with followers or publicly."
      />

      <AppCard style={styles.card}>
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Post body
          </Text>
          <TextInput
            accessibilityLabel="Post body"
            editable={!isSubmitting}
            multiline
            onBlur={() => {
              setBodyBlurred(true);
            }}
            onChangeText={(bodyText) => {
              if (isPostSubmissionActive()) {
                return;
              }

              setSuccessMessage(null);
              setState((current) =>
                updatePostComposerBody(current, bodyText),
              );
            }}
            placeholder="What do you want to share?"
            placeholderTextColor={theme.colors.textMuted}
            style={[
              styles.input,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.border,
                color: theme.colors.text,
              },
            ]}
            value={state.bodyText}
          />
          <Text style={[styles.counter, { color: theme.colors.textMuted }]}>
            {trimmedBodyLength}/{POST_COMPOSER_BODY_TEXT_MAX_LENGTH}
          </Text>
          {visibleMessage ? (
            <Text style={[styles.validation, { color: theme.colors.error }]}>
              {visibleMessage}
            </Text>
          ) : null}
          {successMessage ? (
            <Text style={[styles.validation, { color: theme.colors.accent }]}>
              {successMessage}
            </Text>
          ) : null}
        </View>

        <View style={styles.segmentedGroup}>
          <Text style={[styles.label, { color: theme.colors.text }]}>Media</Text>
          <View
            style={[
              styles.mediaPanel,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.border,
              },
            ]}
          >
            {mediaState.selection ? (
              <Text style={[styles.mediaSummary, { color: theme.colors.text }]}>
                {formatMediaSummary(mediaState.selection)}
              </Text>
            ) : null}
            <Text
              style={[
                styles.validation,
                {
                  color:
                    mediaState.errorMessage !== null
                      ? theme.colors.error
                      : theme.colors.textMuted,
                },
              ]}
            >
              {getMediaStatusMessage(mediaState)}
            </Text>
            <View style={styles.buttonRow}>
              {!mediaState.selection &&
              !isMediaPreparationActive(mediaState.stage) ? (
                <AppButton
                  disabled={isSubmitting}
                  label="Select media"
                  onPress={selectMedia}
                  variant="secondary"
                />
              ) : null}
              {mediaState.selection &&
              !isMediaPreparationActive(mediaState.stage) &&
              mediaState.stage !== 'submitting' &&
              mediaState.stage !== 'succeeded' ? (
                <AppButton
                  disabled={isSubmitting}
                  label="Replace"
                  onPress={selectMedia}
                  variant="secondary"
                />
              ) : null}
              {mediaState.selection &&
              mediaState.stage !== 'submitting' &&
              mediaState.stage !== 'succeeded' ? (
                <AppButton
                  disabled={isSubmitting}
                  label="Remove"
                  onPress={removeMedia}
                  variant="secondary"
                />
              ) : null}
              {isMediaPreparationActive(mediaState.stage) ? (
                <AppButton
                  label="Cancel upload"
                  onPress={cancelMedia}
                  variant="secondary"
                />
              ) : null}
              {mediaState.stage === 'failed' ? (
                <AppButton
                  disabled={isSubmitting}
                  label="Retry upload"
                  onPress={retryMedia}
                  variant="secondary"
                />
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.segmentedGroup}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Post kind
          </Text>
          <View style={styles.buttonRow}>
            {POST_COMPOSER_KINDS.map((kind) => (
              <AppButton
                disabled={isSubmitting}
                key={kind}
                label={POST_COMPOSER_KIND_LABELS[kind]}
                onPress={() => {
                  if (isPostSubmissionActive()) {
                    return;
                  }

                  setSuccessMessage(null);
                  setState((current) =>
                    selectPostComposerKind(current, kind),
                  );
                }}
                variant={state.kind === kind ? 'primary' : 'secondary'}
                selected={state.kind === kind}
              />
            ))}
          </View>
        </View>

        <View style={styles.segmentedGroup}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Audience
          </Text>
          <View style={styles.buttonRow}>
            {POST_COMPOSER_VISIBILITIES.map((visibility) => (
              <AppButton
                disabled={isSubmitting}
                key={visibility}
                label={POST_COMPOSER_VISIBILITY_LABELS[visibility]}
                onPress={() => {
                  if (isPostSubmissionActive()) {
                    return;
                  }

                  setSuccessMessage(null);
                  setState((current) =>
                    selectPostComposerVisibility(current, visibility),
                  );
                }}
                variant={
                  state.visibility === visibility ? 'primary' : 'secondary'
                }
                selected={state.visibility === visibility}
              />
            ))}
          </View>
        </View>

        <View style={styles.actionRow}>
          <AppButton
            disabled={isSubmitting}
            label="Cancel"
            onPress={handleCancel}
            variant="secondary"
          />
          <AppButton
            disabled={!canSubmit || isSubmitting}
            label={isSubmitting ? 'Posting...' : 'Post'}
            onPress={handleSubmit}
            variant="primary"
          />
        </View>
      </AppCard>
    </ScrollView>
  );
}

function isMediaPreparationActive(
  stage: MediaPostPublishingState['stage'],
): boolean {
  return ['selecting', 'requesting', 'uploading', 'processing'].includes(stage);
}

function isMediaPreparationBlocking(
  stage: MediaPostPublishingState['stage'],
): boolean {
  return (
    isMediaPreparationActive(stage) ||
    stage === 'selected' ||
    stage === 'failed'
  );
}

function formatMediaSummary(selection: PickedPostMedia): string {
  const kind = selection.mediaKind === 'image' ? 'Image' : 'Video';

  return `${kind}: ${selection.fileName ?? selection.mimeType}`;
}

function getMediaStatusMessage(state: MediaPostPublishingState): string {
  if (state.errorMessage !== null) {
    return state.errorMessage;
  }

  switch (state.stage) {
    case 'idle':
      return 'No media selected.';
    case 'selecting':
      return 'Opening media library...';
    case 'selected':
      return 'Media selected.';
    case 'requesting':
      return 'Preparing secure upload...';
    case 'uploading':
      return 'Uploading media...';
    case 'processing':
      return 'Processing media...';
    case 'ready':
      return 'Media ready to publish.';
    case 'submitting':
      return 'Publishing post...';
    case 'succeeded':
      return 'Post created.';
    case 'failed':
      return 'We could not publish this media. Try again.';
    case 'cancelled':
      return 'Media publishing cancelled.';
  }
}
