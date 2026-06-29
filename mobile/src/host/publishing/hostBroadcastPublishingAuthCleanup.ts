import type { HostBroadcastPublishingSessionStore } from './hostBroadcastPublishingSessionStore';

export type HostBroadcastPublishingAuthStatus =
  | 'authenticated'
  | 'loading'
  | 'unauthenticated';

export type ReleaseHostBroadcastPublishingBeforeAuthLossOptions = {
  readonly apiBaseUrl: string;
  readonly endLiveSessionTimeoutMs?: number;
  readonly fetchImpl?: typeof fetch;
  readonly getAccessToken: () => string | null;
  readonly store: Pick<
    HostBroadcastPublishingSessionStore,
    'releaseIfCurrent' | 'retainedEntries'
  >;
};

const END_RETAINED_HOST_PUBLISHING_SESSION_MUTATION = `
  mutation HostBroadcastPublishingSessionAuthCleanupEndMutation($input: EndLiveSessionInput!) {
    endLiveSession(input: $input) {
      liveSession {
        id
      }
      errors {
        field
        message
      }
    }
  }
`;

const AUTH_LOSS_END_LIVE_SESSION_TIMEOUT_MS = 5_000;

export function releaseHostBroadcastPublishingAfterAuthStateChange(
  previousStatus: HostBroadcastPublishingAuthStatus,
  nextStatus: HostBroadcastPublishingAuthStatus,
  store: Pick<HostBroadcastPublishingSessionStore, 'releaseAll'>,
): readonly string[] {
  if (previousStatus === 'authenticated' && nextStatus !== 'authenticated') {
    return store.releaseAll();
  }

  return [];
}

export async function releaseHostBroadcastPublishingBeforeAuthLoss({
  apiBaseUrl,
  endLiveSessionTimeoutMs = AUTH_LOSS_END_LIVE_SESSION_TIMEOUT_MS,
  fetchImpl = fetch,
  getAccessToken,
  store,
}: ReleaseHostBroadcastPublishingBeforeAuthLossOptions): Promise<
  readonly string[]
> {
  const accessToken = getAccessToken();
  const retainedEntries = store.retainedEntries();

  if (!accessToken) {
    return [];
  }

  const releasedLiveSessionIds = await Promise.all(
    retainedEntries.map(async ({ liveSessionId, resource }) => {
      if (
        await endRetainedHostPublishingLiveSession({
          accessToken,
          apiBaseUrl,
          fetchImpl,
          liveSessionId,
          timeoutMs: endLiveSessionTimeoutMs,
        })
      ) {
        return store.releaseIfCurrent(liveSessionId, resource)
          ? liveSessionId
          : null;
      }

      return null;
    }),
  );

  return releasedLiveSessionIds.filter(
    (liveSessionId): liveSessionId is string => liveSessionId !== null,
  );
}

async function endRetainedHostPublishingLiveSession({
  accessToken,
  apiBaseUrl,
  fetchImpl,
  liveSessionId,
  timeoutMs,
}: {
  readonly accessToken: string;
  readonly apiBaseUrl: string;
  readonly fetchImpl: typeof fetch;
  readonly liveSessionId: string;
  readonly timeoutMs: number;
}): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  let response: Response;

  try {
    response = await fetchImpl(`${apiBaseUrl}/graphql`, {
      body: JSON.stringify({
        query: END_RETAINED_HOST_PUBLISHING_SESSION_MUTATION,
        variables: {
          input: { liveSessionId },
        },
      }),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
      signal: controller.signal,
    });
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    return false;
  }

  let body: unknown;

  try {
    body = await response.json();
  } catch {
    return false;
  }

  return isSuccessfulEndLiveSessionResponse(body);
}

function isSuccessfulEndLiveSessionResponse(body: unknown): boolean {
  if (!isObject(body) || hasEntries(body.errors)) {
    return false;
  }

  const data = body.data;
  if (!isObject(data)) {
    return false;
  }

  const payload = data.endLiveSession;
  if (!isObject(payload) || hasEntries(payload.errors)) {
    return false;
  }

  return isObject(payload.liveSession);
}

function hasEntries(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
