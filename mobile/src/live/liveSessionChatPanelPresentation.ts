import type {
  LiveSessionChatChannelStatus,
  LiveSessionChatSendStatus,
} from './liveSessionChatReducer';
import type { LiveSessionTimelineHistoryRow } from './liveSessionTimelineHistory';

export type LiveSessionChatPanelRowModel = {
  readonly detail: string;
  readonly id: string;
  readonly title: string;
  readonly tone: 'chat' | 'lifecycle' | 'system';
};

export type LiveSessionChatPanelModel = {
  readonly channelStatusLabel: string;
  readonly composerDisabled: boolean;
  readonly emptyStateMessage: string | null;
  readonly rows: ReadonlyArray<LiveSessionChatPanelRowModel>;
  readonly sendButtonDisabled: boolean;
  readonly sendButtonLabel: string;
  readonly sendError: string | null;
};

export type LiveSessionChatPanelModelInput = {
  readonly channelStatus: LiveSessionChatChannelStatus;
  readonly draftMessage: string;
  readonly isJoined: boolean;
  readonly rows: ReadonlyArray<LiveSessionTimelineHistoryRow>;
  readonly sendError: string | null;
  readonly sendStatus: LiveSessionChatSendStatus;
};

export function createLiveSessionChatPanelModel({
  channelStatus,
  draftMessage,
  isJoined,
  rows,
  sendError,
  sendStatus,
}: LiveSessionChatPanelModelInput): LiveSessionChatPanelModel {
  const composerDisabled =
    !isJoined || channelStatus !== 'joined' || sendStatus === 'sending';
  const sendBody = readLiveSessionChatPanelSendBody(draftMessage);

  return {
    channelStatusLabel: formatLiveSessionChatChannelStatus(
      channelStatus,
      isJoined,
    ),
    composerDisabled,
    emptyStateMessage:
      rows.length === 0 ? 'Chat history will appear here.' : null,
    rows: rows.map(formatLiveSessionChatPanelRow),
    sendButtonDisabled: composerDisabled || !sendBody,
    sendButtonLabel: sendStatus === 'sending' ? 'Sending...' : 'Send',
    sendError,
  };
}

export function readLiveSessionChatPanelSendBody(body: string): string | null {
  const trimmed = body.trim();

  return trimmed.length > 0 ? trimmed : null;
}

export function shouldClearLiveSessionChatPanelDraftAfterSend(
  sendSucceeded: boolean,
): boolean {
  return sendSucceeded;
}

function formatLiveSessionChatPanelRow(
  row: LiveSessionTimelineHistoryRow,
): LiveSessionChatPanelRowModel {
  switch (row.kind) {
    case 'chat_message':
      return {
        detail: row.edited ? 'Edited' : 'Message',
        id: row.id,
        title: row.body,
        tone: 'chat',
      };
    case 'lifecycle':
      return {
        detail: 'System',
        id: row.id,
        title: row.label,
        tone: 'lifecycle',
      };
    default:
      return {
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
