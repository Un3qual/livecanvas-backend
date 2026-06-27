import type {
  LiveSessionChannel,
  LiveSessionChannelPush,
  LiveSessionChannelPushStatus,
} from '../../../src/live/liveSessionChannelClient';

export class FakePush implements LiveSessionChannelPush {
  private readonly callbacks = new Map<
    LiveSessionChannelPushStatus,
    (payload: unknown) => void
  >();

  receive(
    status: LiveSessionChannelPushStatus,
    callback: (payload: unknown) => void,
  ): this {
    this.callbacks.set(status, callback);
    return this;
  }

  resolve(
    status: LiveSessionChannelPushStatus,
    payload: unknown = {},
  ): void {
    const callback = this.callbacks.get(status);

    if (!callback) {
      throw new Error(`No callback registered for ${status}`);
    }

    callback(payload);
  }
}

export type FakeChannelPushRecord = {
  readonly eventName: string;
  readonly payload: Record<string, unknown>;
  readonly push: FakePush;
};

export class FakeChannel implements LiveSessionChannel {
  readonly closeHandlers: Array<() => void> = [];
  readonly errorHandlers: Array<(payload: unknown) => void> = [];
  readonly handlers = new Map<string, Array<(payload: unknown) => void>>();
  readonly joinPush = new FakePush();
  readonly leavePush = new FakePush();
  readonly pushes: FakeChannelPushRecord[] = [];
  leaveCount = 0;

  join(): LiveSessionChannelPush {
    return this.joinPush;
  }

  leave(): LiveSessionChannelPush {
    this.leaveCount += 1;
    return this.leavePush;
  }

  on(eventName: string, callback: (payload: unknown) => void): number {
    const handlers = this.handlers.get(eventName) ?? [];
    handlers.push(callback);
    this.handlers.set(eventName, handlers);
    return handlers.length;
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
