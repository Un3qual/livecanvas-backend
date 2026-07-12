import {
  act,
  fireEvent,
  render,
  screen,
} from '@testing-library/react-native';
import { useEffect } from 'react';
import { Pressable, Text } from 'react-native';

import {
  useLiveSessionChatControls,
  type LiveSessionChatControlsController,
  type LiveSessionChatTimelineMutationAction,
} from '../../src/live/chat/useLiveSessionChatControls';

type MutationConfig = {
  readonly onCompleted?: (payload: Record<string, unknown>) => void;
  readonly onError?: (error: Error) => void;
  readonly variables: Record<string, unknown>;
};

type MutationCommit = jest.Mock<void, [MutationConfig]>;

let mockEditCommit: MutationCommit;
let mockRemoveCommit: MutationCommit;

jest.mock('react-relay', () => ({
  graphql: jest.fn((query: TemplateStringsArray) => query.join('')),
  useMutation: (mutation: unknown) => {
    const operation = mockRelayOperationName(mutation);

    return operation.includes('EditMutation')
      ? [mockEditCommit, false]
      : [mockRemoveCommit, false];
  },
}));

function mockRelayOperationName(mutation: unknown): string {
  if (typeof mutation === 'string') {
    return mutation;
  }

  if (
    mutation !== null &&
    typeof mutation === 'object' &&
    'params' in mutation
  ) {
    const params = mutation.params as { readonly name?: unknown };

    return typeof params.name === 'string' ? params.name : '';
  }

  return '';
}

beforeEach(() => {
  mockEditCommit = jest.fn();
  mockRemoveCommit = jest.fn();
});

describe('useLiveSessionChatControls', () => {
  test('closes same-tick duplicate and conflicting actions for one row', async () => {
    let controller: LiveSessionChatControlsController | null = null;
    await render(<Harness onController={(value) => { controller = value; }} />);

    await act(() => {
      controller?.editMessage('event-1', 'updated body');
      controller?.editMessage('event-1', 'updated body');
      controller?.removeMessage('event-1');
    });

    expect(mockEditCommit).toHaveBeenCalledTimes(1);
    expect(mockRemoveCommit).not.toHaveBeenCalled();
    expect(mockEditCommit.mock.calls[0]?.[0].variables).toEqual({
      input: { body: 'updated body', chatMessageEventId: 'event-1' },
    });
    expect(screen.getByTestId('pending').props.children).toBe('edit');
  });

  test('dispatches a confirmed edit projection and settles only its current attempt', async () => {
    const dispatchTimeline = jest.fn();
    await render(<Harness dispatchTimeline={dispatchTimeline} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Edit message' }));

    await act(() => {
      mockEditCommit.mock.calls[0]?.[0].onCompleted?.({
        editLiveChatMessage: {
          chatMessageEvent: {
            actor: { id: 'viewer-1' },
            body: 'updated body',
            editCount: 1,
            edited: true,
            editedAt: '2026-07-11T12:01:00.000000Z',
            id: 'event-1',
          },
          errors: [],
        },
      });
    });

    expect(dispatchTimeline).toHaveBeenCalledWith({
      event: {
        actor: { id: 'viewer-1' },
        body: 'updated body',
        editCount: 1,
        edited: true,
        editedAt: '2026-07-11T12:01:00.000000Z',
        id: 'event-1',
      },
      type: 'mutation_update_confirmed',
    });
    expect(screen.getByTestId('pending').props.children).toBe('none');
    expect(screen.getByTestId('error').props.children).toBe('none');

    await act(() => {
      mockEditCommit.mock.calls[0]?.[0].onError?.(new Error('late'));
    });
    expect(screen.getByTestId('error').props.children).toBe('none');
  });

  test('tombstones a confirmed removal and dispatches the opaque removed ID', async () => {
    const dispatchTimeline = jest.fn();
    await render(<Harness dispatchTimeline={dispatchTimeline} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Remove message' }));

    await act(() => {
      mockRemoveCommit.mock.calls[0]?.[0].onCompleted?.({
        removeLiveChatMessageEvent: {
          errors: [],
          removedTimelineEventId: 'event-1',
        },
      });
    });

    expect(dispatchTimeline).toHaveBeenCalledWith({
      eventId: 'event-1',
      type: 'mutation_remove_confirmed',
    });
    expect(screen.getByTestId('removed').props.children).toBe('yes');
    expect(screen.getByTestId('pending').props.children).toBe('none');
  });

  test('keeps payload and transport failures row-local and clearable', async () => {
    await render(<Harness />);

    await fireEvent.press(screen.getByRole('button', { name: 'Edit message' }));
    await act(() => {
      mockEditCommit.mock.calls[0]?.[0].onCompleted?.({
        editLiveChatMessage: {
          chatMessageEvent: null,
          errors: [{ field: null, message: 'session_ended' }],
        },
      });
    });
    expect(screen.getByTestId('error').props.children).toBe(
      'This live session has ended.',
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Clear row error' }));
    expect(screen.getByTestId('error').props.children).toBe('none');

    await fireEvent.press(screen.getByRole('button', { name: 'Edit message' }));
    await act(() => {
      mockEditCommit.mock.calls[1]?.[0].onError?.(new Error('network'));
    });
    expect(screen.getByTestId('error').props.children).toBe(
      'Could not update this message. Try again.',
    );
  });

  test('reconciles an accepted mutation after session end hides the controls', async () => {
    const dispatchTimeline = jest.fn();
    const view = await render(<Harness dispatchTimeline={dispatchTimeline} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Edit message' }));
    const editCompletion = mockEditCommit.mock.calls[0]?.[0].onCompleted;

    await view.rerender(
      <Harness dispatchTimeline={dispatchTimeline} sessionStatus="ENDED" />,
    );
    expect(screen.getByTestId('pending').props.children).toBe('none');

    await act(() => {
      editCompletion?.({
        editLiveChatMessage: {
          chatMessageEvent: {
            actor: { id: 'viewer-1' },
            body: 'accepted before end',
            editCount: 1,
            edited: true,
            editedAt: '2026-07-11T12:01:00.000000Z',
            id: 'event-1',
          },
          errors: [],
        },
      });
    });

    expect(dispatchTimeline).toHaveBeenCalledWith({
      event: {
        actor: { id: 'viewer-1' },
        body: 'accepted before end',
        editCount: 1,
        edited: true,
        editedAt: '2026-07-11T12:01:00.000000Z',
        id: 'event-1',
      },
      type: 'mutation_update_confirmed',
    });
  });

  test('reconciles an accepted mutation after logout hides the controls', async () => {
    const dispatchTimeline = jest.fn();
    const view = await render(<Harness dispatchTimeline={dispatchTimeline} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Edit message' }));
    const editCompletion = mockEditCommit.mock.calls[0]?.[0].onCompleted;

    await view.rerender(
      <Harness dispatchTimeline={dispatchTimeline} viewerId={null} />,
    );
    expect(screen.getByTestId('pending').props.children).toBe('none');

    await act(() => {
      editCompletion?.({
        editLiveChatMessage: {
          chatMessageEvent: {
            actor: { id: 'viewer-1' },
            body: 'accepted before logout',
            editCount: 1,
            edited: true,
            editedAt: '2026-07-11T12:01:00.000000Z',
            id: 'event-1',
          },
          errors: [],
        },
      });
    });

    expect(dispatchTimeline).toHaveBeenCalledWith({
      event: {
        actor: { id: 'viewer-1' },
        body: 'accepted before logout',
        editCount: 1,
        edited: true,
        editedAt: '2026-07-11T12:01:00.000000Z',
        id: 'event-1',
      },
      type: 'mutation_update_confirmed',
    });
  });

  test('invalidates pending callbacks on auth identity change and unmount', async () => {
    const dispatchTimeline = jest.fn();
    const view = await render(<Harness dispatchTimeline={dispatchTimeline} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Edit message' }));
    const editCompletion = mockEditCommit.mock.calls[0]?.[0].onCompleted;

    await view.rerender(
      <Harness dispatchTimeline={dispatchTimeline} viewerId={null} />,
    );
    await view.rerender(
      <Harness dispatchTimeline={dispatchTimeline} viewerId="viewer-2" />,
    );
    expect(screen.getByTestId('pending').props.children).toBe('none');

    await act(() => {
      editCompletion?.({
        editLiveChatMessage: {
          chatMessageEvent: {
            actor: { id: 'viewer-1' },
            body: 'stale',
            editCount: 1,
            edited: true,
            editedAt: '2026-07-11T12:01:00.000000Z',
            id: 'event-1',
          },
          errors: [],
        },
      });
    });
    expect(dispatchTimeline).not.toHaveBeenCalled();

    await view.rerender(<Harness dispatchTimeline={dispatchTimeline} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Remove message' }));
    const removeCompletion = mockRemoveCommit.mock.calls[0]?.[0].onCompleted;
    await view.unmount();

    await act(() => {
      removeCompletion?.({
        removeLiveChatMessageEvent: {
          errors: [],
          removedTimelineEventId: 'event-1',
        },
      });
    });
    expect(dispatchTimeline).not.toHaveBeenCalled();
  });
});

function Harness({
  dispatchTimeline = () => undefined,
  hostId = 'viewer-1',
  onController,
  sessionStatus = 'LIVE',
  viewerId = 'viewer-1',
}: {
  dispatchTimeline?: (action: LiveSessionChatTimelineMutationAction) => void;
  hostId?: string | null;
  onController?: (controller: LiveSessionChatControlsController) => void;
  sessionStatus?: string | null;
  viewerId?: string | null;
}) {
  const controller = useLiveSessionChatControls({
    dispatchTimeline,
    hostId,
    sessionStatus,
    viewerId,
  });
  const pending = controller.controlsState.pendingByEventId['event-1'];

  useEffect(() => {
    onController?.(controller);
  }, [controller, onController]);

  return (
    <>
      <Text testID="pending">{pending?.action ?? 'none'}</Text>
      <Text testID="error">
        {controller.controlsState.errorsByEventId['event-1'] ?? 'none'}
      </Text>
      <Text testID="removed">
        {controller.controlsState.removedEventIds['event-1'] ? 'yes' : 'no'}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => controller.editMessage('event-1', 'updated body')}
      >
        <Text>Edit message</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => controller.removeMessage('event-1')}
      >
        <Text>Remove message</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => controller.clearRowError('event-1')}
      >
        <Text>Clear row error</Text>
      </Pressable>
    </>
  );
}
