import { afterEach, describe, expect, mock, test } from 'bun:test';

type FakePhoenixSocketOptions = {
  readonly params?: Record<string, unknown> | (() => Record<string, unknown>);
};

const socketInstances: FakePhoenixSocket[] = [];

class FakePhoenixSocket {
  readonly connectParams: Array<Record<string, unknown> | undefined> = [];
  readonly endpoint: string;
  readonly options: FakePhoenixSocketOptions;

  constructor(endpoint: string, options: FakePhoenixSocketOptions) {
    this.endpoint = endpoint;
    this.options = options;
    socketInstances.push(this);
  }

  connect(): void {
    const params =
      typeof this.options.params === 'function'
        ? this.options.params()
        : this.options.params;

    this.connectParams.push(params);
  }
}

function importPhoenixSocketModule() {
  return import(`./phoenixSocket?test=${crypto.randomUUID()}`);
}

afterEach(() => {
  mock.restore();
  socketInstances.length = 0;
});

describe('createPhoenixSocket', () => {
  test('uses the exact websocket URL and reads auth params at connect time', async () => {
    mock.module('phoenix', () => ({
      Socket: FakePhoenixSocket,
    }));

    const { createPhoenixSocket } = await importPhoenixSocketModule();

    const issuedTokens = ['initial-access-token', 'rotated-access-token'];
    const tokenReads: Array<string | null> = [];
    const socket = createPhoenixSocket({
      getAccessToken: () => {
        const token = issuedTokens.shift() ?? null;
        tokenReads.push(token);
        return token;
      },
      websocketUrl: 'wss://api.example.test/socket',
    });

    expect(socketInstances).toHaveLength(1);
    expect(socketInstances[0].endpoint).toBe(
      'wss://api.example.test/socket',
    );
    expect(tokenReads).toEqual([]);

    socket.connect();
    socket.connect();

    expect(tokenReads).toEqual([
      'initial-access-token',
      'rotated-access-token',
    ]);
    expect(socketInstances[0].connectParams).toEqual([
      { token: 'initial-access-token' },
      { token: 'rotated-access-token' },
    ]);
  });
});
