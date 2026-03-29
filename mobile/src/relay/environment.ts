import {
  Environment,
  Network,
  RecordSource,
  Store,
  FetchFunction,
} from 'relay-runtime';

/**
 * Build a basic fetch function that posts to the GraphQL endpoint.
 * Task 3 will replace this with an authenticated version.
 */
export function createFetchFunction(apiBaseUrl: string): FetchFunction {
  return async (operation, variables) => {
    const response = await fetch(`${apiBaseUrl}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: operation.text,
        variables,
      }),
    });
    return response.json();
  };
}

export function createRelayEnvironment(apiBaseUrl: string): Environment {
  return new Environment({
    network: Network.create(createFetchFunction(apiBaseUrl)),
    store: new Store(new RecordSource()),
  });
}
