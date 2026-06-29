import type { DiagnosticsProbeStatus } from './releaseDiagnosticsPresentation';

export const API_PROBE_TIMEOUT_MS = 5_000;
export const WEBSOCKET_PROBE_TIMEOUT_MS = 3_000;

const API_PROBE_QUERY = 'query ReleaseDiagnosticsProbe { __typename }';
const PHOENIX_TRANSPORT_PATH = 'websocket';
const PHOENIX_TRANSPORT_VSN = '2.0.0';

type ApiProbeResponse = Pick<Response, 'ok' | 'status' | 'text'>;

type ApiProbeFetch = (
  input: string,
  init?: RequestInit,
) => Promise<ApiProbeResponse>;

type ApiProbeOptions = {
  apiBaseUrl: string;
  fetchImpl?: ApiProbeFetch;
  timeoutMs?: number;
};

export type ReleaseDiagnosticsWebSocket = {
  close: () => void;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
  onopen: (() => void) | null;
};

type WebsocketProbeOptions = {
  websocketUrl: string;
  createWebSocket?: (url: string) => ReleaseDiagnosticsWebSocket;
  timeoutMs?: number;
};

export async function runApiReachabilityProbe({
  apiBaseUrl,
  fetchImpl = fetch,
  timeoutMs = API_PROBE_TIMEOUT_MS,
}: ApiProbeOptions): Promise<DiagnosticsProbeStatus> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetchImpl(`${trimTrailingSlash(apiBaseUrl)}/graphql`, {
      body: JSON.stringify({
        query: API_PROBE_QUERY,
        variables: {},
      }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      signal: controller.signal,
    });

    if (!response.ok) {
      return failed(`HTTP ${response.status} transport failure`);
    }

    const bodyText = await response.text();

    try {
      JSON.parse(bodyText);
      return { status: 'reachable' };
    } catch {
      return failed('GraphQL response was not valid JSON');
    }
  } catch {
    if (controller.signal.aborted) {
      return failed('API probe timed out');
    }

    return failed('Network request failed');
  } finally {
    clearTimeout(timeout);
  }
}

export function runWebsocketReachabilityProbe({
  websocketUrl,
  createWebSocket = createGlobalWebSocket,
  timeoutMs = WEBSOCKET_PROBE_TIMEOUT_MS,
}: WebsocketProbeOptions): Promise<DiagnosticsProbeStatus> {
  const transportUrl = phoenixWebsocketTransportUrl(websocketUrl);

  if (transportUrl.status === 'failed') {
    return Promise.resolve(failed(transportUrl.reason));
  }

  return new Promise((resolve) => {
    let socket: ReleaseDiagnosticsWebSocket | null = null;
    let settled = false;

    const finish = (status: DiagnosticsProbeStatus) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);

      try {
        socket?.close();
      } catch {
        // Closing is best-effort; the diagnostic result is already known.
      }

      resolve(status);
    };

    const timeout = setTimeout(() => {
      finish(failed('Websocket probe timed out'));
    }, timeoutMs);

    try {
      socket = createWebSocket(transportUrl.url);
    } catch {
      finish(failed('Websocket connection failed'));
      return;
    }

    socket.onopen = () => {
      finish({ status: 'reachable' });
    };
    socket.onerror = () => {
      finish(failed('Websocket connection failed'));
    };
    socket.onclose = () => {
      finish(failed('Websocket closed before opening'));
    };
  });
}

function failed(reason: string): DiagnosticsProbeStatus {
  return { status: 'failed', reason };
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

type PhoenixTransportUrlResult =
  | { status: 'ok'; url: string }
  | { status: 'failed'; reason: string };

function phoenixWebsocketTransportUrl(rawUrl: string): PhoenixTransportUrlResult {
  try {
    const url = new URL(rawUrl);

    if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
      return {
        status: 'failed',
        reason: 'Websocket URL must start with ws:// or wss://',
      };
    }

    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    url.pathname = phoenixTransportPath(url.pathname);
    url.searchParams.set('vsn', PHOENIX_TRANSPORT_VSN);

    return { status: 'ok', url: url.toString() };
  } catch {
    return { status: 'failed', reason: 'Websocket URL is not valid' };
  }
}

function phoenixTransportPath(pathname: string): string {
  const trimmedPathname = pathname.replace(/\/+$/, '');

  if (trimmedPathname.endsWith(`/${PHOENIX_TRANSPORT_PATH}`)) {
    return trimmedPathname;
  }

  return `${trimmedPathname}/${PHOENIX_TRANSPORT_PATH}`;
}

function createGlobalWebSocket(url: string): ReleaseDiagnosticsWebSocket {
  const maybeGlobal = globalThis as typeof globalThis & {
    WebSocket?: new (url: string) => ReleaseDiagnosticsWebSocket;
  };

  if (!maybeGlobal.WebSocket) {
    throw new Error('WebSocket is not available');
  }

  return new maybeGlobal.WebSocket(url) as unknown as ReleaseDiagnosticsWebSocket;
}
