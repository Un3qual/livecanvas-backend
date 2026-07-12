import { useEffect, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ListRenderItem,
} from 'react-native';

import { AppButton } from '../../components/AppButton';
import { AppCard } from '../../components/AppCard';
import { useAppTheme } from '../../providers/ThemeProvider';
import { radius, spacing, typography } from '../../theme/tokens';
import type {
  LiveSessionChatChannelStatus,
  LiveSessionChatSendStatus,
} from './liveSessionChatState';
import type { LiveSessionChatControlsController } from './useLiveSessionChatControls';
import {
  createLiveSessionChatPanelModel,
  formatLiveSessionChatPanelRow,
} from './liveSessionChatPanelPresentation';
import type { LiveSessionTimelineHistoryRow } from '../liveSessionTimelineHistory';

export type LiveSessionChatMessageControls =
  LiveSessionChatControlsController & {
    readonly hostId: string | null;
    readonly sessionStatus: string | null;
    readonly viewerId: string | null;
  };

type LiveSessionChatPanelProps = {
  readonly canLoadOlder: boolean;
  readonly channelStatus: LiveSessionChatChannelStatus;
  readonly isJoined: boolean;
  readonly isLoadingOlder: boolean;
  readonly messageControls?: LiveSessionChatMessageControls;
  readonly olderLoadError: string | null;
  readonly onLoadOlder: () => void;
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
  timelineList: {
    maxHeight: 320,
  },
  timelineContent: {
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
  rowActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  rowAction: {
    flexGrow: 1,
  },
  editInput: {
    ...typography.body,
    borderRadius: radius.sm,
    borderWidth: 1,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  emptyText: typography.body,
  errorText: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  composer: {
    gap: spacing.sm,
  },
  loadOlderButton: {
    alignSelf: 'stretch',
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
  canLoadOlder,
  channelStatus,
  isJoined,
  isLoadingOlder,
  messageControls,
  olderLoadError,
  onLoadOlder,
  onSendMessage,
  rows,
  sendError,
  sendStatus,
}: LiveSessionChatPanelProps) {
  const theme = useAppTheme();
  const [draftMessage, setDraftMessage] = useState('');
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editDraftsByEventId, setEditDraftsByEventId] = useState<
    Readonly<Record<string, string>>
  >({});
  const [removeConfirmationEventId, setRemoveConfirmationEventId] = useState<
    string | null
  >(null);
  const model = createLiveSessionChatPanelModel({
    canLoadOlder,
    channelStatus,
    draftMessage,
    isJoined,
    isLoadingOlder,
    olderLoadError,
    rows,
    sendError,
    sendStatus,
  });

  useEffect(() => {
    if (messageControls?.sessionStatus === 'ENDED') {
      setEditingEventId(null);
      setRemoveConfirmationEventId(null);
      setEditDraftsByEventId({});
      return;
    }

    if (
      editingEventId &&
      !rows.some(
        (row) =>
          row.id === editingEventId &&
          formatLiveSessionChatPanelRow(row, messageControls).canEdit,
      )
    ) {
      setEditingEventId(null);
    }

    if (
      removeConfirmationEventId &&
      !rows.some(
        (row) =>
          row.id === removeConfirmationEventId &&
          formatLiveSessionChatPanelRow(row, messageControls).canRemove,
      )
    ) {
      setRemoveConfirmationEventId(null);
    }
  }, [
    editingEventId,
    messageControls,
    removeConfirmationEventId,
    rows,
  ]);

  const renderTimelineItem: ListRenderItem<LiveSessionTimelineHistoryRow> = ({
    item,
  }) => {
    const row = formatLiveSessionChatPanelRow(item, messageControls);
    const isEditing = editingEventId === item.id && row.canEdit;
    const isConfirmingRemoval = removeConfirmationEventId === item.id;
    const editDraft =
      editDraftsByEventId[item.id] ??
      (item.kind === 'chat_message' ? item.body : '');
    const rowAccessibilityName = row.title.slice(0, 80);

    function beginEdit(preserveDraft = false) {
      if (item.kind !== 'chat_message' || row.isPending) {
        return;
      }

      messageControls?.clearRowError(item.id);
      setRemoveConfirmationEventId(null);
      if (!preserveDraft || editDraftsByEventId[item.id] === undefined) {
        setEditDraftsByEventId((current) => ({
          ...current,
          [item.id]: item.body,
        }));
      }
      setEditingEventId(item.id);
    }

    function saveEdit() {
      const body = editDraft.trim();

      if (!messageControls || row.isPending || body.length === 0) {
        return;
      }

      messageControls.editMessage(item.id, body);
      setEditingEventId(null);
    }

    function retryRowAction() {
      messageControls?.clearRowError(item.id);

      if (row.failedAction === 'remove' && row.canRemove) {
        setRemoveConfirmationEventId(item.id);
      } else if (row.failedAction === 'edit' && row.canEdit) {
        beginEdit(true);
      } else if (row.canEdit) {
        beginEdit(true);
      } else if (row.canRemove) {
        setRemoveConfirmationEventId(item.id);
      }
    }

    return (
      <View
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
        {isEditing ? (
          <TextInput
            accessibilityLabel="Edit message"
            editable={!row.isPending}
            maxLength={2000}
            onChangeText={(body) =>
              setEditDraftsByEventId((current) => ({
                ...current,
                [item.id]: body,
              }))
            }
            style={[
              styles.editInput,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                color: theme.colors.text,
              },
            ]}
            value={editDraft}
          />
        ) : (
          <Text style={[styles.rowTitle, { color: theme.colors.text }]}>
            {row.title}
          </Text>
        )}

        {row.error ? (
          <>
            <Text style={[styles.errorText, { color: theme.colors.error }]}>
              {row.error}
            </Text>
            <AppButton
              accessibilityLabel={`${
                row.failedAction === 'remove'
                  ? 'Retry removing'
                  : 'Retry editing'
              } message: ${rowAccessibilityName}`}
              label="Retry"
              onPress={retryRowAction}
              style={styles.rowAction}
              variant="secondary"
            />
          </>
        ) : null}

        {isEditing ? (
          <View style={styles.rowActions}>
            <AppButton
              disabled={row.isPending || editDraft.trim().length === 0}
              label={row.pendingAction === 'edit' ? 'Editing...' : 'Save'}
              onPress={saveEdit}
              style={styles.rowAction}
            />
            <AppButton
              disabled={row.isPending}
              label="Cancel"
              onPress={() => {
                setEditingEventId(null);
                setEditDraftsByEventId((current) =>
                  Object.fromEntries(
                    Object.entries(current).filter(
                      ([eventId]) => eventId !== item.id,
                    ),
                  ),
                );
              }}
              style={styles.rowAction}
              variant="secondary"
            />
          </View>
        ) : (
          <View style={styles.rowActions}>
            {row.canEdit ? (
              <AppButton
                accessibilityLabel={`Edit message: ${rowAccessibilityName}`}
                disabled={row.isPending}
                label={row.pendingAction === 'edit' ? 'Editing...' : 'Edit'}
                onPress={() => beginEdit()}
                style={styles.rowAction}
                variant="secondary"
              />
            ) : null}
            {row.canRemove && !isConfirmingRemoval ? (
              <AppButton
                accessibilityLabel={`Remove message: ${rowAccessibilityName}`}
                disabled={row.isPending}
                label={row.pendingAction === 'remove' ? 'Removing...' : 'Remove'}
                onPress={() => {
                  messageControls?.clearRowError(item.id);
                  setEditingEventId(null);
                  setRemoveConfirmationEventId(item.id);
                }}
                style={styles.rowAction}
                variant="secondary"
              />
            ) : null}
            {row.canRemove && isConfirmingRemoval ? (
              <>
                <AppButton
                  disabled={row.isPending}
                  label={row.pendingAction === 'remove' ? 'Removing...' : 'Confirm remove'}
                  onPress={() => {
                    setRemoveConfirmationEventId(null);
                    messageControls?.removeMessage(item.id);
                  }}
                  style={styles.rowAction}
                />
                <AppButton
                  disabled={row.isPending}
                  label="Cancel removal"
                  onPress={() => setRemoveConfirmationEventId(null)}
                  style={styles.rowAction}
                  variant="secondary"
                />
              </>
            ) : null}
          </View>
        )}
      </View>
    );
  };

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

      {model.canLoadOlder ? (
        <AppButton
          disabled={model.olderLoadButtonDisabled}
          label={model.olderLoadButtonLabel}
          onPress={onLoadOlder}
          style={styles.loadOlderButton}
          variant="secondary"
        />
      ) : null}

      {model.olderLoadError ? (
        <Text style={[styles.errorText, { color: theme.colors.error }]}>
          {model.olderLoadError}
        </Text>
      ) : null}

      <FlatList
        contentContainerStyle={styles.timelineContent}
        data={model.rows}
        extraData={{
          controlsState: messageControls?.controlsState,
          editingEventId,
          removeConfirmationEventId,
          sessionStatus: messageControls?.sessionStatus,
        }}
        keyExtractor={(row) => row.id}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
            {model.emptyStateMessage}
          </Text>
        }
        nestedScrollEnabled
        renderItem={renderTimelineItem}
        showsVerticalScrollIndicator={false}
        style={styles.timelineList}
      />

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
