import type {
  LiveSessionChatChannelStatus,
  LiveSessionChatSendStatus,
} from './liveSessionChatState';
import {
  canEditChatRow,
  canRemoveChatRow,
  type LiveSessionChatControlAction,
  type LiveSessionChatControlsState,
} from './liveSessionChatControlsState';
import type { LiveSessionTimelineHistoryRow } from '../liveSessionTimelineHistory';

export type LiveSessionChatPanelRowModel = {
  readonly canEdit: boolean;
  readonly canRemove: boolean;
  readonly detail: string;
  readonly error: string | null;
  readonly id: string;
  readonly isPending: boolean;
  readonly pendingAction: LiveSessionChatControlAction | null;
  readonly title: string;
  readonly tone: 'chat' | 'lifecycle' | 'system';
};

export type LiveSessionChatPanelRowControlsInput = {
  readonly controlsState: LiveSessionChatControlsState;
  readonly hostId: string | null;
  readonly sessionStatus: string | null;
  readonly viewerId: string | null;
};

export type LiveSessionChatPanelModel = {
  readonly channelStatusLabel: string;
  readonly composerDisabled: boolean;
  readonly canLoadOlder: boolean;
  readonly emptyStateMessage: string | null;
  readonly olderLoadButtonDisabled: boolean;
  readonly olderLoadButtonLabel: string;
  readonly olderLoadError: string | null;
  readonly rows: ReadonlyArray<LiveSessionTimelineHistoryRow>;
  readonly sendButtonDisabled: boolean;
  readonly sendButtonLabel: string;
  readonly sendError: string | null;
};

export type LiveSessionChatPanelModelInput = {
  readonly canLoadOlder: boolean;
  readonly channelStatus: LiveSessionChatChannelStatus;
  readonly draftMessage: string;
  readonly isJoined: boolean;
  readonly isLoadingOlder: boolean;
  readonly olderLoadError: string | null;
  readonly rows: ReadonlyArray<LiveSessionTimelineHistoryRow>;
  readonly sendError: string | null;
  readonly sendStatus: LiveSessionChatSendStatus;
};

export function createLiveSessionChatPanelModel({
  canLoadOlder,
  channelStatus,
  draftMessage,
  isJoined,
  isLoadingOlder,
  olderLoadError,
  rows,
  sendError,
  sendStatus,
}: LiveSessionChatPanelModelInput): LiveSessionChatPanelModel {
  // The composer opens only when membership, channel readiness, and send
  // backpressure all agree; dropping any gate can lose or duplicate messages.
  const composerDisabled =
    !isJoined || channelStatus !== 'joined' || sendStatus === 'sending';
  const hasSendBody = draftMessage.trim().length > 0;

  return {
    channelStatusLabel: formatLiveSessionChatChannelStatus(
      channelStatus,
      isJoined,
    ),
    canLoadOlder,
    composerDisabled,
    emptyStateMessage:
      rows.length === 0 ? 'Chat history will appear here.' : null,
    olderLoadButtonDisabled: isLoadingOlder,
    olderLoadButtonLabel: isLoadingOlder
      ? 'Loading older messages...'
      : 'Load older messages',
    olderLoadError,
    rows,
    sendButtonDisabled: composerDisabled || !hasSendBody,
    sendButtonLabel: sendStatus === 'sending' ? 'Sending...' : 'Send',
    sendError,
  };
}

export function formatLiveSessionChatPanelRow(
  row: LiveSessionTimelineHistoryRow,
  controls?: LiveSessionChatPanelRowControlsInput,
): LiveSessionChatPanelRowModel {
  const pendingAction = controls?.controlsState.pendingByEventId[row.id]?.action ?? null;
  const controlModel = {
    canEdit: controls
      ? canEditChatRow({
          row,
          sessionStatus: controls.sessionStatus,
          viewerId: controls.viewerId,
        })
      : false,
    canRemove: controls
      ? canRemoveChatRow({
          hostId: controls.hostId,
          row,
          sessionStatus: controls.sessionStatus,
          viewerId: controls.viewerId,
        })
      : false,
    error: controls?.controlsState.errorsByEventId[row.id] ?? null,
    isPending: pendingAction !== null,
    pendingAction,
  };

  switch (row.kind) {
    case 'chat_message':
      return {
        ...controlModel,
        detail: row.edited ? 'Edited' : 'Message',
        id: row.id,
        title: row.body,
        tone: 'chat',
      };
    case 'lifecycle':
      return {
        ...controlModel,
        detail: 'System',
        id: row.id,
        title: row.label,
        tone: 'lifecycle',
      };
    default:
      return {
        ...controlModel,
        detail: 'System',
        id: row.id,
        title: row.label,
        tone: 'system',
      };
  }
}

function formatLiveSessionChatChannelStatus(
  channelStatus: LiveSessionChatChannelStatus,
  isJoined: boolean,
): string {
  if (!isJoined) {
    return 'Join the live session to use chat.';
  }

  switch (channelStatus) {
    case 'joined':
      return 'Chat connected.';
    case 'joining':
      return 'Joining chat...';
    case 'errored':
      return 'Chat connection failed.';
    case 'closed':
      return 'Chat disconnected.';
    case 'idle':
    default:
      return 'Chat channel is idle.';
  }
}
