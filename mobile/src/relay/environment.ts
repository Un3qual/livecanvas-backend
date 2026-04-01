import {
  Environment,
  Network,
  RecordSource,
  Store,
  type FetchFunction,
} from 'relay-runtime';

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
    return response.json();
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
