import {
  render,
  screen,
  userEvent,
} from '@testing-library/react-native';

import {
  LiveSessionChatPanel,
  type LiveSessionChatMessageControls,
} from '../../src/live/chat/LiveSessionChatPanel';
import { createLiveSessionChatControlsState } from '../../src/live/chat/liveSessionChatControlsState';
import type { LiveSessionTimelineHistoryRow } from '../../src/live/liveSessionTimelineHistory';

jest.mock('../../src/providers/ThemeProvider', () => ({
  useAppTheme: () => ({
    colors: {
      accent: '#0000ff',
      accentText: '#ffffff',
      background: '#ffffff',
      border: '#cccccc',
      error: '#ff0000',
      surface: '#ffffff',
      surfaceMuted: '#eeeeee',
      text: '#111111',
      textMuted: '#666666',
    },
  }),
}));

describe('LiveSessionChatPanel message controls', () => {
  test('edits an authored row, trims the saved body, and preserves the send draft', async () => {
    const user = userEvent.setup();
    const controls = messageControls({
      hostId: 'viewer-1',
      viewerId: 'viewer-1',
    });
    await renderPanel({ controls, rows: [chatRow('event-1', 'viewer-1')] });

    await user.type(screen.getByPlaceholderText('Write a message'), 'send draft');
    await user.press(screen.getByRole('button', { name: 'Edit' }));
    await user.clear(screen.getByLabelText('Edit message'));
    await user.type(screen.getByLabelText('Edit message'), '  updated body  ');
    await user.press(screen.getByRole('button', { name: 'Save' }));

    expect(controls.editMessage).toHaveBeenCalledWith(
      'event-1',
      'updated body',
    );
    expect(screen.getByPlaceholderText('Write a message').props.value).toBe(
      'send draft',
    );
  });

  test('requires deliberate host removal confirmation and supports cancellation', async () => {
    const user = userEvent.setup();
    const controls = messageControls({
      hostId: 'viewer-1',
      viewerId: 'viewer-1',
    });
    await renderPanel({ controls, rows: [chatRow('event-1', 'viewer-2')] });

    await user.press(screen.getByRole('button', { name: 'Remove' }));
    expect(controls.removeMessage).not.toHaveBeenCalled();
    await user.press(screen.getByRole('button', { name: 'Cancel removal' }));
    expect(screen.queryByRole('button', { name: 'Confirm remove' })).toBeNull();

    await user.press(screen.getByRole('button', { name: 'Remove' }));
    await user.press(screen.getByRole('button', { name: 'Confirm remove' }));
    expect(controls.removeMessage).toHaveBeenCalledTimes(1);
    expect(controls.removeMessage).toHaveBeenCalledWith('event-1');
  });

  test('hides lifecycle and ended-session actions and closes an open editor on end', async () => {
    const user = userEvent.setup();
    const controls = messageControls({
      hostId: 'viewer-1',
      viewerId: 'viewer-1',
    });
    const rows = [
      chatRow('event-1', 'viewer-1'),
      lifecycleRow('event-started'),
    ];
    const view = await renderPanel({ controls, rows });

    expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Remove' })).toHaveLength(1);
    await user.press(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText('Edit message')).toBeOnTheScreen();

    await view.rerender(
      panel({
        controls: { ...controls, sessionStatus: 'ENDED' },
        rows,
      }),
    );

    expect(screen.queryByLabelText('Edit message')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
  });

  test('disables only the pending row and keeps row errors visible with retry', async () => {
    const user = userEvent.setup();
    const controlsState = {
      ...createLiveSessionChatControlsState(),
      errorsByEventId: { 'event-1': 'This live session has ended.' },
      pendingByEventId: {
        'event-2': { action: 'edit' as const, attemptId: 2 },
      },
    };
    const controls = messageControls({
      controlsState,
      hostId: 'viewer-3',
      viewerId: 'viewer-1',
    });
    await renderPanel({
      controls,
      rows: [chatRow('event-1', 'viewer-1'), chatRow('event-2', 'viewer-1')],
    });

    expect(screen.getByText('This live session has ended.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Editing...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeEnabled();

    await user.press(screen.getByRole('button', { name: 'Retry' }));
    expect(controls.clearRowError).toHaveBeenCalledWith('event-1');
    expect(screen.getByLabelText('Edit message')).toBeOnTheScreen();
  });
});

function renderPanel({
  controls,
  rows,
}: {
  controls: LiveSessionChatMessageControls;
  rows: ReadonlyArray<LiveSessionTimelineHistoryRow>;
}) {
  return render(panel({ controls, rows }));
}

function panel({
  controls,
  rows,
}: {
  controls: LiveSessionChatMessageControls;
  rows: ReadonlyArray<LiveSessionTimelineHistoryRow>;
}) {
  return (
    <LiveSessionChatPanel
      canLoadOlder={false}
      channelStatus="joined"
      isJoined
      isLoadingOlder={false}
      messageControls={controls}
      olderLoadError={null}
      onLoadOlder={() => undefined}
      onSendMessage={() => Promise.resolve(true)}
      rows={rows}
      sendError={null}
      sendStatus="idle"
    />
  );
}

function messageControls(
  overrides: Partial<LiveSessionChatMessageControls> = {},
): LiveSessionChatMessageControls {
  return {
    clearRowError: jest.fn(),
    controlsState: createLiveSessionChatControlsState(),
    editMessage: jest.fn(),
    hostId: 'host-1',
    removeMessage: jest.fn(),
    sessionStatus: 'LIVE',
    viewerId: 'viewer-1',
    ...overrides,
  };
}

function chatRow(
  id: string,
  actorId: string,
): Extract<LiveSessionTimelineHistoryRow, { kind: 'chat_message' }> {
  return {
    __typename: 'ChatMessageEvent',
    actor: { id: actorId },
    body: `body-${id}`,
    cursor: `cursor-${id}`,
    editCount: 0,
    edited: false,
    editedAt: null,
    eventType: 'CHAT_MESSAGE_SENT',
    id,
    kind: 'chat_message',
    occurredAt: '2026-07-11T12:00:00.000000Z',
  };
}

function lifecycleRow(
  id: string,
): Extract<LiveSessionTimelineHistoryRow, { kind: 'lifecycle' }> {
  return {
    __typename: 'LiveSessionStartedEvent',
    actor: { id: 'viewer-1' },
    cursor: `cursor-${id}`,
    eventType: 'LIVE_SESSION_STARTED',
    id,
    kind: 'lifecycle',
    label: 'Live started',
    occurredAt: '2026-07-11T11:59:00.000000Z',
  };
}
