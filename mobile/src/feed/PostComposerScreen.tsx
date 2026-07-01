import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { AppHeader } from '../components/AppHeader';
import { useAppTheme } from '../providers/ThemeProvider';
import { radius, spacing, typography } from '../theme/tokens';
import {
  POST_COMPOSER_BODY_TEXT_MAX_LENGTH,
  POST_COMPOSER_KINDS,
  POST_COMPOSER_VISIBILITIES,
  buildCreatePostInput,
  canSubmitPostComposer,
  createPostComposerState,
  getPostComposerValidationMessage,
  selectPostComposerKind,
  selectPostComposerVisibility,
  updatePostComposerBody,
  type CreatePostInput,
  type PostComposerKind,
  type PostComposerVisibility,
} from './postComposerState';

export type PostComposerScreenProps = {
  onSubmitInput?: (input: CreatePostInput) => void;
};

const POST_COMPOSER_KIND_LABELS: Record<PostComposerKind, string> = {
  STANDARD: 'Standard',
  STORY: 'Story',
};

const POST_COMPOSER_VISIBILITY_LABELS: Record<PostComposerVisibility, string> =
  {
    FOLLOWERS: 'Followers',
    PUBLIC: 'Public',
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

export function PostComposerScreen({
  onSubmitInput,
}: PostComposerScreenProps) {
  const router = useRouter();
  const theme = useAppTheme();
  const [state, setState] = useState(() => createPostComposerState());
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [bodyBlurred, setBodyBlurred] = useState(false);
  const trimmedBodyLength = state.bodyText.trim().length;
  const validationMessage = getPostComposerValidationMessage(state);
  const canSubmit = canSubmitPostComposer(state);
  const shouldShowValidation =
    validationMessage !== null &&
    (submitAttempted ||
      bodyBlurred ||
      trimmedBodyLength > POST_COMPOSER_BODY_TEXT_MAX_LENGTH);

  function handleSubmit() {
    const input = buildCreatePostInput(state);

    if (input === null) {
      setSubmitAttempted(true);
      return;
    }

    onSubmitInput?.(input);
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
        subtitle="Share a text update with followers or publish it publicly."
      />

      <AppCard style={styles.card}>
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Post body
          </Text>
          <TextInput
            accessibilityLabel="Post body"
            multiline
            onBlur={() => {
              setBodyBlurred(true);
            }}
            onChangeText={(bodyText) => {
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
          {shouldShowValidation ? (
            <Text style={[styles.validation, { color: theme.colors.error }]}>
              {validationMessage}
            </Text>
          ) : null}
        </View>

        <View style={styles.segmentedGroup}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Post kind
          </Text>
          <View style={styles.buttonRow}>
            {POST_COMPOSER_KINDS.map((kind) => (
              <AppButton
                key={kind}
                label={POST_COMPOSER_KIND_LABELS[kind]}
                onPress={() => {
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
                key={visibility}
                label={POST_COMPOSER_VISIBILITY_LABELS[visibility]}
                onPress={() => {
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
            label="Cancel"
            onPress={() => {
              router.back();
            }}
            variant="secondary"
          />
          <AppButton
            disabled={!canSubmit}
            label="Post"
            onPress={handleSubmit}
            variant="primary"
          />
        </View>
      </AppCard>
    </ScrollView>
  );
}
