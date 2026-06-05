import { describe, expect, test } from 'bun:test';

import {
  createLiveSessionChannelClient,
  shouldCloseLiveSessionChatChannelAfterJoin,
  type LiveSessionChannel,
  type LiveSessionChannelPush,
} from './liveSessionChannelClient';
import type { LiveSessionRealtimeEvent } from './liveSessionRealtimeEvents';

type PushStatus = 'ok' | 'error' | 'timeout';

class FakePush implements LiveSessionChannelPush {
  private readonly callbacks = new Map<PushStatus, (payload: unknown) => void>();

  receive(status: PushStatus, callback: (payload: unknown) => void): this {
    this.callbacks.set(status, callback);
    return this;
  }

  resolve(status: PushStatus, payload: unknown = {}): void {
    const callback = this.callbacks.get(status);

    if (!callback) {
      throw new Error(`No callback registered for ${status}`);
    }

    callback(payload);
  }
}

class FakeChannel implements LiveSessionChannel {
  readonly closeHandlers: Array<() => void> = [];
  readonly errorHandlers: Array<(payload: unknown) => void> = [];
  readonly handlers = new Map<string, Array<(payload: unknown) => void>>();
  readonly joinPush = new FakePush();
  readonly leavePush = new FakePush();
  readonly pushes: Array<{
    readonly eventName: string;
    readonly payload: Record<string, unknown>;
    readonly push: FakePush;
  }> = [];
  joinError: Error | null = null;
  pushError: Error | null = null;

  join(): LiveSessionChannelPush {
    if (this.joinError) {
      throw this.joinError;
    }

    return this.joinPush;
  }

  leave(): LiveSessionChannelPush {
    return this.leavePush;
  }

  on(eventName: string, callback: (payload: unknown) => void): number {
    const existing = this.handlers.get(eventName) ?? [];
    existing.push(callback);
    this.handlers.set(eventName, existing);
    return existing.length;
  }

  onClose(callback: () => void): number {
    this.closeHandlers.push(callback);
    return this.closeHandlers.length;
  }

  onError(callback: (payload: unknown) => void): number {
    this.errorHandlers.push(callback);
    return this.errorHandlers.length;
  }

  push(
    eventName: string,
    payload: Record<string, unknown>,
  ): LiveSessionChannelPush {
    if (this.pushError) {
      throw this.pushError;
    }

    const push = new FakePush();
    this.pushes.push({ eventName, payload, push });
    return push;
  }

  emit(eventName: string, payload: unknown): void {
    for (const callback of this.handlers.get(eventName) ?? []) {
      callback(payload);
    }
  }

  close(): void {
    for (const callback of this.closeHandlers) {
      callback();
    }
  }

  error(payload: unknown = {}): void {
    for (const callback of this.errorHandlers) {
      callback(payload);
    }
  }
}

function timelineEventPayload(overrides: Record<string, unknown> = {}) {
  return {
    __typename: 'ChatMessageEvent',
    actor: { id: 'actor-id' },
    body: 'hello from chat',
    edit_count: 0,
    edited: false,
    edited_at: null,
    event_type: 'chat_message_sent',
    id: 'timeline-event-id',
    occurred_at: '2026-06-04T20:15:30Z',
    ...overrides,
  };
}

function createHarness(topic = ' live_session:opaque:topic/with-segments ') {
  const channel = new FakeChannel();
  const topics: string[] = [];
  const sessionStates: LiveSessionRealtimeEvent[] = [];
  const timelineEvents: LiveSessionRealtimeEvent[] = [];
  const updatedTimelineEvents: LiveSessionRealtimeEvent[] = [];
  const removedTimelineEvents: LiveSessionRealtimeEvent[] = [];
  const closeEvents: string[] = [];
  const errorEvents: string[] = [];
  const socket = {
    channel: (nextTopic: string) => {
      topics.push(nextTopic);
      return channel;
    },
  };
  const client = createLiveSessionChannelClient({
    onClose: () => closeEvents.push('closed'),
    onError: (reason) => errorEvents.push(reason),
    onSessionState: (event) => sessionStates.push(event),
    onTimelineEvent: (event) => timelineEvents.push(event),
    onTimelineEventRemoved: (event) => removedTimelineEvents.push(event),
    onTimelineEventUpdated: (event) => updatedTimelineEvents.push(event),
    socket,
    topic,
  });

  return {
    channel,
    client,
    closeEvents,
    errorEvents,
    removedTimelineEvents,
    sessionStates,
    timelineEvents,
    topics,
    updatedTimelineEvents,
  };
}

describe('createLiveSessionChannelClient', () => {
  test('preserves opaque channel topics without parsing them', () => {
    const { topics } = createHarness(' live_session:relay-id:extra/segment ');

    expect(topics).toEqual([' live_session:relay-id:extra/segment ']);
  });

  test('normalizes join acknowledgements containing session state', async () => {
    const { channel, client } = createHarness();

    const join = client.join();
    channel.joinPush.resolve('ok', {
      session_state: {
        status: 'live',
        visibility: 'followers',
        viewer_count: 7,
      },
    });

    await expect(join).resolves.toEqual({
      sessionState: {
        kind: 'session_state',
        status: 'LIVE',
        viewerCount: 7,
        visibility: 'FOLLOWERS',
      },
      status: 'joined',
    });
  });

  test('marks joined ended-session acknowledgements as immediately closable', () => {
    expect(
      shouldCloseLiveSessionChatChannelAfterJoin({
        sessionState: {
          kind: 'session_state',
          status: 'ENDED',
          viewerCount: 0,
          visibility: 'PUBLIC',
        },
        status: 'joined',
      }),
    ).toBe(true);
    expect(
      shouldCloseLiveSessionChatChannelAfterJoin({
        sessionState: {
          kind: 'session_state',
          status: 'LIVE',
          viewerCount: 1,
          visibility: 'PUBLIC',
        },
        status: 'joined',
      }),
    ).toBe(false);
    expect(
      shouldCloseLiveSessionChatChannelAfterJoin({
        reason: 'Could not join live chat. Please try again.',
        status: 'error',
      }),
    ).toBe(false);
  });

  test('maps join setup exceptions to error results', async () => {
    const { channel, client } = createHarness();
    channel.joinError = new Error('join setup failed');

    await expect(client.join()).resolves.toEqual({
      reason: 'Could not join live chat. Please try again.',
      status: 'error',
    });
  });

  test('normalizes session state broadcast callbacks', () => {
    const { channel, sessionStates } = createHarness();

    channel.emit('session:state', {
      session_state: {
        status: 'ended',
        visibility: 'public',
        viewer_count: 3,
      },
    });

    expect(sessionStates).toEqual([
      {
        kind: 'session_state',
        status: 'ENDED',
        viewerCount: 3,
        visibility: 'PUBLIC',
      },
    ]);
  });

  test('normalizes timeline broadcast callbacks', () => {
    const {
      channel,
      removedTimelineEvents,
      timelineEvents,
      updatedTimelineEvents,
    } = createHarness();

    channel.emit('timeline:event', {
      event: timelineEventPayload(),
    });
    channel.emit('timeline:event_updated', {
      event: timelineEventPayload({
        body: 'edited chat',
        edit_count: 1,
        edited: true,
        edited_at: '2026-06-04T20:17:30Z',
        event_type: 'chat_message_edited',
        id: 'updated-timeline-event-id',
      }),
    });
    channel.emit('timeline:event_removed', {
      removed_timeline_event_id: 'removed-timeline-event-id',
    });

    expect(timelineEvents).toEqual([
      {
        event: {
          __typename: 'ChatMessageEvent',
          actor: { id: 'actor-id' },
          body: 'hello from chat',
          editCount: 0,
          edited: false,
          editedAt: null,
          eventType: 'chat_message_sent',
          id: 'timeline-event-id',
          occurredAt: '2026-06-04T20:15:30Z',
        },
        kind: 'timeline_event',
      },
    ]);
    expect(updatedTimelineEvents).toEqual([
      {
        event: {
          __typename: 'ChatMessageEvent',
          actor: { id: 'actor-id' },
          body: 'edited chat',
          editCount: 1,
          edited: true,
          editedAt: '2026-06-04T20:17:30Z',
          eventType: 'chat_message_edited',
          id: 'updated-timeline-event-id',
          occurredAt: '2026-06-04T20:15:30Z',
        },
        kind: 'timeline_event_updated',
      },
    ]);
    expect(removedTimelineEvents).toEqual([
      {
        kind: 'timeline_event_removed',
        removedTimelineEventId: 'removed-timeline-event-id',
      },
    ]);
  });

  test('notifies channel close and error callbacks', () => {
    const { channel, closeEvents, errorEvents } = createHarness();

    channel.close();
    channel.error({ reason: 'transport_down' });

    expect(closeEvents).toEqual(['closed']);
    expect(errorEvents).toEqual(['Chat connection failed.']);
  });

  test('pushes chat message sends and normalizes successful replies', async () => {
    const { channel, client } = createHarness();

    const send = client.sendChatMessage('hello channel');

    expect(channel.pushes).toHaveLength(1);
    expect(channel.pushes[0].eventName).toBe('timeline:chat_message:send');
    expect(channel.pushes[0].payload).toEqual({ body: 'hello channel' });

    channel.pushes[0].push.resolve('ok', {
      event: timelineEventPayload({
        body: 'hello channel',
        id: 'sent-event-id',
      }),
    });

    await expect(send).resolves.toEqual({
      event: {
        __typename: 'ChatMessageEvent',
        actor: { id: 'actor-id' },
        body: 'hello channel',
        editCount: 0,
        edited: false,
        editedAt: null,
        eventType: 'chat_message_sent',
        id: 'sent-event-id',
        occurredAt: '2026-06-04T20:15:30Z',
      },
      status: 'ok',
    });
  });

  test('maps chat send failures to viewer-safe reason strings', async () => {
    const { channel, client } = createHarness();

    const ended = client.sendChatMessage('after end');
    channel.pushes[0].push.resolve('error', {
      reason: 'live_session_ended',
    });
    await expect(ended).resolves.toEqual({
      reason: 'This live session has ended.',
      status: 'error',
    });

    const internal = client.sendChatMessage('internal failure');
    channel.pushes[1].push.resolve('error', {
      reason: 'database_primary_unavailable',
    });
    await expect(internal).resolves.toEqual({
      reason: 'Could not send message. Please try again.',
      status: 'error',
    });
  });

  test('maps chat send setup exceptions to error results', async () => {
    const { channel, client } = createHarness();
    channel.pushError = new Error('push setup failed');

    await expect(client.sendChatMessage('hello')).resolves.toEqual({
      reason: 'Could not send message. Please try again.',
      status: 'error',
    });
    expect(channel.pushes).toHaveLength(0);
  });

  test('ignores malformed broadcast payloads', () => {
    const { channel, timelineEvents } = createHarness();

    channel.emit('timeline:event', {
      event: {
        id: 'missing-required-fields',
      },
    });

    expect(timelineEvents).toEqual([]);
  });
});
