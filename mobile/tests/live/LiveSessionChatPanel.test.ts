import { describe, expect, test } from 'bun:test';

import { createLiveSessionChatPanelModel } from '../../src/live/chat/liveSessionChatPanelPresentation';
import type { LiveSessionTimelineHistoryRow } from '../../src/live/liveSessionTimelineHistory';

describe('LiveSessionChatPanel presentation model', () => {
  test('labels retained chat, lifecycle, and future timeline rows', () => {
    const model = createLiveSessionChatPanelModel({
      channelStatus: 'joined',
      draftMessage: 'hello',
      isJoined: true,
      rows: [
        chatRow({
          body: 'Retained hello',
          edited: true,
          editCount: 2,
          id: 'event-chat-1',
        }),
        lifecycleRow({
          id: 'event-started-1',
          label: 'Live started',
        }),
        unknownRow({
          id: 'event-future-1',
          label: 'Timeline event',
        }),
      ],
      canLoadOlder: false,
      isLoadingOlder: false,
      olderLoadError: null,
      sendError: null,
      sendStatus: 'idle',
    });

    expect(model.emptyStateMessage).toBeNull();
    expect(model.rows).toEqual([
      {
        detail: 'Edited',
        id: 'event-chat-1',
        tone: 'chat',
        title: 'Retained hello',
      },
      {
        detail: 'System',
        id: 'event-started-1',
        tone: 'lifecycle',
        title: 'Live started',
      },
      {
        detail: 'System',
        id: 'event-future-1',
        tone: 'system',
        title: 'Timeline event',
      },
    ]);
  });

  test('disables the composer until the viewer is joined and the channel is joined', () => {
    expect(
      createLiveSessionChatPanelModel({
        channelStatus: 'idle',
        draftMessage: 'hello',
        isJoined: false,
        rows: [],
        canLoadOlder: false,
        isLoadingOlder: false,
        olderLoadError: null,
        sendError: null,
        sendStatus: 'idle',
      }),
    ).toMatchObject({
      channelStatusLabel: 'Join the live session to use chat.',
      composerDisabled: true,
      sendButtonDisabled: true,
      sendButtonLabel: 'Send',
    });

    expect(
      createLiveSessionChatPanelModel({
        channelStatus: 'joining',
        draftMessage: 'hello',
        isJoined: true,
        rows: [],
        canLoadOlder: false,
        isLoadingOlder: false,
        olderLoadError: null,
        sendError: null,
        sendStatus: 'idle',
      }),
    ).toMatchObject({
      channelStatusLabel: 'Joining chat...',
      composerDisabled: true,
      sendButtonDisabled: true,
    });

    expect(
      createLiveSessionChatPanelModel({
        channelStatus: 'joined',
        draftMessage: 'hello',
        isJoined: true,
        rows: [],
        canLoadOlder: false,
        isLoadingOlder: false,
        olderLoadError: null,
        sendError: null,
        sendStatus: 'idle',
      }),
    ).toMatchObject({
      channelStatusLabel: 'Chat connected.',
      composerDisabled: false,
      sendButtonDisabled: false,
    });
  });

  test('shows pending send state and viewer-safe send errors', () => {
    expect(
      createLiveSessionChatPanelModel({
        channelStatus: 'joined',
        draftMessage: 'hello',
        isJoined: true,
        rows: [],
        canLoadOlder: false,
        isLoadingOlder: false,
        olderLoadError: null,
        sendError: null,
        sendStatus: 'sending',
      }),
    ).toMatchObject({
      composerDisabled: true,
      sendButtonDisabled: true,
      sendButtonLabel: 'Sending...',
    });

    expect(
      createLiveSessionChatPanelModel({
        channelStatus: 'errored',
        draftMessage: 'hello',
        isJoined: true,
        rows: [],
        canLoadOlder: false,
        isLoadingOlder: false,
        olderLoadError: null,
        sendError: 'Message is too long.',
        sendStatus: 'failed',
      }),
    ).toMatchObject({
      channelStatusLabel: 'Chat connection failed.',
      sendError: 'Message is too long.',
    });
  });

  test('prevents blank message sends while allowing trimmed drafts', () => {
    expect(
      createLiveSessionChatPanelModel({
        channelStatus: 'joined',
        draftMessage: '   ',
        isJoined: true,
        rows: [],
        canLoadOlder: false,
        isLoadingOlder: false,
        olderLoadError: null,
        sendError: null,
        sendStatus: 'idle',
      }).sendButtonDisabled,
    ).toBe(true);

    expect(
      createLiveSessionChatPanelModel({
        channelStatus: 'joined',
        draftMessage: '  hello chat  ',
        isJoined: true,
        rows: [],
        canLoadOlder: false,
        isLoadingOlder: false,
        olderLoadError: null,
        sendError: null,
        sendStatus: 'idle',
      }).sendButtonDisabled,
    ).toBe(false);
  });

  test('bounds visible chat rows to the newest retained window', () => {
    const rows = Array.from({ length: 55 }, (_, index) =>
      chatRow({
        body: `message-${index}`,
        id: `event-chat-${index}`,
      }),
    );
    const model = createLiveSessionChatPanelModel({
      channelStatus: 'joined',
      draftMessage: '',
      isJoined: true,
      rows,
      canLoadOlder: false,
      isLoadingOlder: false,
      olderLoadError: null,
      sendError: null,
      sendStatus: 'idle',
    });

    expect(model.rows).toHaveLength(50);
    expect(model.rows[0].id).toBe('event-chat-5');
    expect(model.rows.at(-1)?.id).toBe('event-chat-54');
  });

  test('exposes older retained history loading state separately from composer state', () => {
    const loadable = createLiveSessionChatPanelModel({
      channelStatus: 'joined',
      draftMessage: 'hello',
      isJoined: true,
      rows: [chatRow({ id: 'event-chat-1' })],
      canLoadOlder: true,
      isLoadingOlder: false,
      olderLoadError: null,
      sendError: null,
      sendStatus: 'idle',
    });

    expect(loadable).toMatchObject({
      canLoadOlder: true,
      olderLoadButtonDisabled: false,
      olderLoadButtonLabel: 'Load older messages',
      olderLoadError: null,
      sendButtonDisabled: false,
    });

    const loading = createLiveSessionChatPanelModel({
      channelStatus: 'joined',
      draftMessage: 'hello',
      isJoined: true,
      rows: [chatRow({ id: 'event-chat-1' })],
      canLoadOlder: true,
      isLoadingOlder: true,
      olderLoadError:
        'We could not load older messages. Check your connection and try again.',
      sendError: null,
      sendStatus: 'idle',
    });

    expect(loading).toMatchObject({
      canLoadOlder: true,
      olderLoadButtonDisabled: true,
      olderLoadButtonLabel: 'Loading older messages...',
      olderLoadError:
        'We could not load older messages. Check your connection and try again.',
      sendButtonDisabled: false,
    });
  });
});

function chatRow(
  overrides: Partial<Extract<LiveSessionTimelineHistoryRow, { kind: 'chat_message' }>>,
): Extract<LiveSessionTimelineHistoryRow, { kind: 'chat_message' }> {
  return {
    __typename: 'ChatMessageEvent',
    actor: { id: 'actor-1' },
    body: 'hello',
    cursor: 'cursor-chat',
    editCount: 0,
    edited: false,
    editedAt: null,
    eventType: 'chat_message',
    id: 'event-chat',
    kind: 'chat_message',
    occurredAt: '2026-06-04T12:00:00Z',
    ...overrides,
  };
}

function lifecycleRow(
  overrides: Partial<Extract<LiveSessionTimelineHistoryRow, { kind: 'lifecycle' }>>,
): Extract<LiveSessionTimelineHistoryRow, { kind: 'lifecycle' }> {
  return {
    __typename: 'LiveSessionStartedEvent',
    actor: null,
    cursor: 'cursor-started',
    eventType: 'live_session_started',
    id: 'event-started',
    kind: 'lifecycle',
    label: 'Live started',
    occurredAt: '2026-06-04T12:00:00Z',
    ...overrides,
  };
}

function unknownRow(
  overrides: Partial<Extract<LiveSessionTimelineHistoryRow, { kind: 'unknown' }>>,
): Extract<LiveSessionTimelineHistoryRow, { kind: 'unknown' }> {
  return {
    __typename: 'FutureEvent',
    actor: null,
    cursor: 'cursor-future',
    eventType: 'future_event',
    id: 'event-future',
    kind: 'unknown',
    label: 'Timeline event',
    occurredAt: '2026-06-04T12:00:00Z',
    ...overrides,
  };
}
