import { describe, expect, test } from 'vitest';
import { createActor } from 'xstate';

import {
  liveSessionChatChannelMachine,
  selectLiveSessionChatChannelState,
} from '../../src/live/chat/state/liveSessionChatChannelMachine';

function startMachine() {
  return createActor(liveSessionChatChannelMachine).start();
}

describe('liveSessionChatChannelMachine', () => {
  test('starts idle and moves through joining, joined, closed, and errored channel states', () => {
    const actor = startMachine();

    expect(selectLiveSessionChatChannelState(actor.getSnapshot())).toEqual({
      channelError: null,
      channelStatus: 'idle',
      sendError: null,
      sendStatus: 'idle',
    });

    actor.send({ sessionId: 'session-1', type: 'SESSION_CHANGED' });
    actor.send({ sessionId: 'session-1', type: 'CHANNEL_JOINING' });

    expect(selectLiveSessionChatChannelState(actor.getSnapshot())).toEqual({
      channelError: null,
      channelStatus: 'joining',
      sendError: null,
      sendStatus: 'idle',
    });

    actor.send({ sessionId: 'session-1', type: 'CHANNEL_JOINED' });

    expect(selectLiveSessionChatChannelState(actor.getSnapshot())).toEqual({
      channelError: null,
      channelStatus: 'joined',
      sendError: null,
      sendStatus: 'idle',
    });

    actor.send({ sessionId: 'session-1', type: 'CHANNEL_CLOSED' });

    expect(selectLiveSessionChatChannelState(actor.getSnapshot())).toEqual({
      channelError: null,
      channelStatus: 'closed',
      sendError: null,
      sendStatus: 'idle',
    });

    actor.send({ sessionId: 'session-1', type: 'CHANNEL_JOINING' });
    actor.send({
      error: 'Chat connection failed.',
      sessionId: 'session-1',
      type: 'CHANNEL_ERRORED',
    });

    expect(selectLiveSessionChatChannelState(actor.getSnapshot())).toEqual({
      channelError: 'Chat connection failed.',
      channelStatus: 'errored',
      sendError: null,
      sendStatus: 'idle',
    });
  });

  test('tracks send start, success, failure, and cancellation for the active session', () => {
    const actor = startMachine();

    actor.send({ sessionId: 'session-1', type: 'SESSION_CHANGED' });
    actor.send({ sessionId: 'session-1', type: 'CHANNEL_JOINED' });
    actor.send({ sessionId: 'session-1', type: 'SEND_STARTED' });

    expect(selectLiveSessionChatChannelState(actor.getSnapshot())).toEqual({
      channelError: null,
      channelStatus: 'joined',
      sendError: null,
      sendStatus: 'sending',
    });

    actor.send({ sessionId: 'session-1', type: 'SEND_SUCCEEDED' });

    expect(selectLiveSessionChatChannelState(actor.getSnapshot())).toEqual({
      channelError: null,
      channelStatus: 'joined',
      sendError: null,
      sendStatus: 'idle',
    });

    actor.send({ sessionId: 'session-1', type: 'SEND_STARTED' });
    actor.send({
      error: 'Message is too long.',
      sessionId: 'session-1',
      type: 'SEND_FAILED',
    });

    expect(selectLiveSessionChatChannelState(actor.getSnapshot())).toEqual({
      channelError: null,
      channelStatus: 'joined',
      sendError: 'Message is too long.',
      sendStatus: 'failed',
    });

    actor.send({ sessionId: 'session-1', type: 'SEND_STARTED' });
    actor.send({ sessionId: 'session-1', type: 'SEND_CANCELLED' });

    expect(selectLiveSessionChatChannelState(actor.getSnapshot())).toEqual({
      channelError: null,
      channelStatus: 'joined',
      sendError: null,
      sendStatus: 'idle',
    });
  });

  test('returns an active joined channel to idle when realtime chat is not maintained', () => {
    const actor = startMachine();

    actor.send({ sessionId: 'session-1', type: 'SESSION_CHANGED' });
    actor.send({ sessionId: 'session-1', type: 'CHANNEL_JOINED' });
    actor.send({ sessionId: 'session-1', type: 'SEND_STARTED' });
    actor.send({ sessionId: 'session-1', type: 'SEND_CANCELLED' });
    actor.send({ sessionId: 'session-1', type: 'CHANNEL_IDLE' });

    expect(selectLiveSessionChatChannelState(actor.getSnapshot())).toEqual({
      channelError: null,
      channelStatus: 'idle',
      sendError: null,
      sendStatus: 'idle',
    });
  });

  test('channel close fails an active send with the disconnect text', () => {
    const closedActor = startMachine();

    closedActor.send({ sessionId: 'session-1', type: 'SESSION_CHANGED' });
    closedActor.send({ sessionId: 'session-1', type: 'CHANNEL_JOINED' });
    closedActor.send({ sessionId: 'session-1', type: 'SEND_STARTED' });
    closedActor.send({ sessionId: 'session-1', type: 'CHANNEL_CLOSED' });

    expect(selectLiveSessionChatChannelState(closedActor.getSnapshot())).toEqual({
      channelError: null,
      channelStatus: 'closed',
      sendError: 'Chat disconnected before the message was sent.',
      sendStatus: 'failed',
    });
  });

  test('channel error fails an active send with the channel error reason', () => {
    const actor = startMachine();

    actor.send({ sessionId: 'session-1', type: 'SESSION_CHANGED' });
    actor.send({ sessionId: 'session-1', type: 'CHANNEL_JOINED' });
    actor.send({ sessionId: 'session-1', type: 'SEND_STARTED' });
    actor.send({
      error: 'Socket error.',
      sessionId: 'session-1',
      type: 'CHANNEL_ERRORED',
    });

    expect(selectLiveSessionChatChannelState(actor.getSnapshot())).toEqual({
      channelError: 'Socket error.',
      channelStatus: 'errored',
      sendError: 'Socket error.',
      sendStatus: 'failed',
    });
  });

  test('ignores stale session events and resets channel/send state for a new session', () => {
    const actor = startMachine();

    actor.send({ sessionId: 'session-1', type: 'SESSION_CHANGED' });
    actor.send({ sessionId: 'session-1', type: 'CHANNEL_JOINED' });
    actor.send({ sessionId: 'session-1', type: 'SEND_STARTED' });

    actor.send({ sessionId: 'session-2', type: 'SEND_SUCCEEDED' });
    actor.send({
      error: 'stale error',
      sessionId: 'session-2',
      type: 'CHANNEL_ERRORED',
    });

    expect(selectLiveSessionChatChannelState(actor.getSnapshot())).toEqual({
      channelError: null,
      channelStatus: 'joined',
      sendError: null,
      sendStatus: 'sending',
    });

    actor.send({ sessionId: 'session-2', type: 'SESSION_CHANGED' });

    expect(selectLiveSessionChatChannelState(actor.getSnapshot())).toEqual({
      channelError: null,
      channelStatus: 'idle',
      sendError: null,
      sendStatus: 'idle',
    });
  });
});
