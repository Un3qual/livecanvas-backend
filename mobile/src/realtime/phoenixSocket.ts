// @ts-expect-error Phoenix does not ship TypeScript declarations.
import { Socket } from 'phoenix';

export type PhoenixAccessTokenProvider = () => string | null;

export type PhoenixSocketOptions = {
  readonly getAccessToken: PhoenixAccessTokenProvider;
  readonly websocketUrl: string;
};

export type PhoenixSocket = {
  readonly channel: (topic: string, params?: Record<string, unknown>) => unknown;
  readonly connect: () => void;
  readonly disconnect: (callback?: () => void) => void;
};

type PhoenixSocketConstructor = new (
  endpoint: string,
  options: {
    readonly params: () => { readonly token: string | null };
  },
) => PhoenixSocket;

const PhoenixSocketConstructor = Socket as PhoenixSocketConstructor;

export function createPhoenixSocket({
  getAccessToken,
  websocketUrl,
}: PhoenixSocketOptions): PhoenixSocket {
  return new PhoenixSocketConstructor(websocketUrl, {
    params: () => ({ token: getAccessToken() }),
  });
}
