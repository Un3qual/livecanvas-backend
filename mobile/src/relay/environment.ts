import {
  Environment,
  Network,
  RecordSource,
  Store,
  type FetchFunction,
  type GraphQLResponse,
} from 'relay-runtime';

function summarizeResponseBody(bodyText: string): string {
  const normalized = bodyText.trim().replace(/\s+/g, ' ');

  if (!normalized) {
    return '';
  }

  return normalized.length > 200 ? `${normalized.slice(0, 197)}...` : normalized;
}

async function parseGraphQLResponse(response: Response): Promise<GraphQLResponse> {
  const bodyText = await response.text();

  if (!bodyText.trim()) {
    if (!response.ok) {
      throw new Error(`GraphQL request failed with ${response.status} ${response.statusText}`);
    }

    throw new Error('GraphQL response body was empty');
  }

  try {
    const parsed = JSON.parse(bodyText) as GraphQLResponse;

    if (!response.ok) {
      return parsed;
    }

    return parsed;
  } catch {
    if (!response.ok) {
      const bodySummary = summarizeResponseBody(bodyText);
      const details = bodySummary ? `: ${bodySummary}` : '';
      throw new Error(`GraphQL request failed with ${response.status} ${response.statusText}${details}`);
    }

    throw new Error(`GraphQL response was not valid JSON (${response.status} ${response.statusText})`);
  }
}

/**
 * Build a basic (unauthenticated) fetch function for the GraphQL endpoint.
 * Used as fallback when no authenticated fetch is provided.
 */
export function createBasicFetch(apiBaseUrl: string): FetchFunction {
  return async (operation, variables) => {
    const response = await fetch(`${apiBaseUrl}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: operation.text ?? '', variables }),
    });
    return parseGraphQLResponse(response);
  };
}

export function createRelayEnvironment(
  apiBaseUrl: string,
  fetchFn?: FetchFunction,
): Environment {
  return new Environment({
    network: Network.create(fetchFn ?? createBasicFetch(apiBaseUrl)),
    store: new Store(new RecordSource()),
  });
}
