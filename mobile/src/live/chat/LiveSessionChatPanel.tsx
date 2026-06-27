import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '../../components/AppButton';
import { AppCard } from '../../components/AppCard';
import { useAppTheme } from '../../providers/ThemeProvider';
import { radius, spacing, typography } from '../../theme/tokens';
import type {
  LiveSessionChatChannelStatus,
  LiveSessionChatSendStatus,
} from '../liveSessionChatReducer';
import { createLiveSessionChatPanelModel } from './liveSessionChatPanelPresentation';
import type { LiveSessionTimelineHistoryRow } from '../liveSessionTimelineHistory';

type LiveSessionChatPanelProps = {
  readonly channelStatus: LiveSessionChatChannelStatus;
  readonly isJoined: boolean;
  readonly onSendMessage: (body: string) => Promise<boolean>;
  readonly rows: ReadonlyArray<LiveSessionTimelineHistoryRow>;
  readonly sendError: string | null;
  readonly sendStatus: LiveSessionChatSendStatus;
};

const styles = StyleSheet.create({
  headerRow: {
    gap: spacing.xs,
  },
  sectionTitle: typography.label,
  statusText: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  timeline: {
    gap: spacing.sm,
  },
  timelineRow: {
    borderRadius: radius.sm,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  rowDetail: {
    ...typography.label,
    fontSize: 12,
    lineHeight: 16,
  },
  rowTitle: typography.body,
  emptyText: typography.body,
  errorText: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  composer: {
    gap: spacing.sm,
  },
  input: {
    ...typography.body,
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  sendButton: {
    alignSelf: 'stretch',
  },
});

export function LiveSessionChatPanel({
  channelStatus,
  isJoined,
  onSendMessage,
  rows,
  sendError,
  sendStatus,
}: LiveSessionChatPanelProps) {
  const theme = useAppTheme();
  const [draftMessage, setDraftMessage] = useState('');
  const model = createLiveSessionChatPanelModel({
    channelStatus,
    draftMessage,
    isJoined,
    rows,
    sendError,
    sendStatus,
  });

  async function handleSendPress() {
    const body = draftMessage.trim();

    if (model.sendButtonDisabled || body.length === 0) {
      return;
    }

    const sendSucceeded = await onSendMessage(body);

    if (sendSucceeded) {
      setDraftMessage('');
    }
  }

  return (
    <AppCard>
      <View style={styles.headerRow}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Chat
        </Text>
        <Text style={[styles.statusText, { color: theme.colors.textMuted }]}>
          {model.channelStatusLabel}
        </Text>
      </View>

      <View style={styles.timeline}>
        {model.rows.length > 0 ? (
          model.rows.map((row) => (
            <View
              key={row.id}
              style={[
                styles.timelineRow,
                {
                  backgroundColor:
                    row.tone === 'chat'
                      ? theme.colors.surfaceMuted
                      : theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text style={[styles.rowDetail, { color: theme.colors.textMuted }]}>
                {row.detail}
              </Text>
              <Text style={[styles.rowTitle, { color: theme.colors.text }]}>
                {row.title}
              </Text>
            </View>
          ))
        ) : (
          <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
            {model.emptyStateMessage}
          </Text>
        )}
      </View>

      {model.sendError ? (
        <Text style={[styles.errorText, { color: theme.colors.error }]}>
          {model.sendError}
        </Text>
      ) : null}

      <View style={styles.composer}>
        <TextInput
          editable={!model.composerDisabled}
          onChangeText={setDraftMessage}
          placeholder="Write a message"
          placeholderTextColor={theme.colors.textMuted}
          style={[
            styles.input,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              color: theme.colors.text,
              opacity: model.composerDisabled ? 0.55 : 1,
            },
          ]}
          value={draftMessage}
        />
        <AppButton
          disabled={model.sendButtonDisabled}
          label={model.sendButtonLabel}
          onPress={handleSendPress}
          style={styles.sendButton}
        />
      </View>
    </AppCard>
  );
}
