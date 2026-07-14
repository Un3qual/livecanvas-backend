import { describe, expect, test } from 'vitest';

import {
  createLiveSessionChatChannelActorLifecycle,
} from '../../src/live/chat/state/liveSessionChatChannelActorLifecycle';
import type { LiveSessionChatChannelViewState } from '../../src/live/chat/state/liveSessionChatChannelMachine';

describe('createLiveSessionChatChannelActorLifecycle', () => {
  test('starts the actor on demand and ignores sends before start or after stop', () => {
    const publishedStates: Array<LiveSessionChatChannelViewState> = [];
    const lifecycle = createLiveSessionChatChannelActorLifecycle({
      onStateChanged: (state) => {
        publishedStates.push(state);
      },
    });

    lifecycle.send({ sessionId: 'session-1', type: 'SESSION_CHANGED' });
    expect(publishedStates).toEqual([]);
    expect(lifecycle.getState()).toEqual({
      channelError: null,
      channelStatus: 'idle',
      sendError: null,
      sendStatus: 'idle',
    });

    lifecycle.start();
    expect(publishedStates.at(-1)).toEqual({
      channelError: null,
      channelStatus: 'idle',
      sendError: null,
      sendStatus: 'idle',
    });

    lifecycle.send({ sessionId: 'session-1', type: 'SESSION_CHANGED' });
    lifecycle.send({ sessionId: 'session-1', type: 'CHANNEL_JOINED' });

    expect(publishedStates.at(-1)).toEqual({
      channelError: null,
      channelStatus: 'joined',
      sendError: null,
      sendStatus: 'idle',
    });

    const publishCountAfterJoin = publishedStates.length;

    lifecycle.stop();
    lifecycle.send({ sessionId: 'session-1', type: 'CHANNEL_CLOSED' });

    expect(publishedStates).toHaveLength(publishCountAfterJoin + 1);
    expect(publishedStates.at(-1)).toEqual({
      channelError: null,
      channelStatus: 'idle',
      sendError: null,
      sendStatus: 'idle',
    });
    expect(lifecycle.getState()).toEqual({
      channelError: null,
      channelStatus: 'idle',
      sendError: null,
      sendStatus: 'idle',
    });
  });
});
