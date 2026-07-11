import React, {
  Suspense,
  createContext,
  useContext,
  useReducer,
  type PropsWithChildren,
  type ReactNode,
} from 'react';

import { ScreenState } from './ScreenState';

type RelayRouteBoundaryProps = {
  readonly children: ReactNode | ((retryKey: number) => ReactNode);
  readonly errorMessage: string;
  readonly loadingMessage: string;
};

const RelayRouteFetchKeyContext = createContext(0);

export function useRelayRouteFetchKey(): number {
  return useContext(RelayRouteFetchKeyContext);
}

export function RelayRouteBoundary({
  children,
  errorMessage,
  loadingMessage,
}: RelayRouteBoundaryProps) {
  const [retryKey, retry] = useReducer((value: number) => value + 1, 0);

  return (
    <RelayRouteErrorBoundary
      key={retryKey}
      message={errorMessage}
      onRetry={retry}
    >
      <RelayRouteFetchKeyContext.Provider value={retryKey}>
        <Suspense
          fallback={<ScreenState state="loading" message={loadingMessage} />}
        >
          {typeof children === 'function' ? children(retryKey) : children}
        </Suspense>
      </RelayRouteFetchKeyContext.Provider>
    </RelayRouteErrorBoundary>
  );
}

type RelayRouteErrorBoundaryProps = PropsWithChildren<{
  readonly message: string;
  readonly onRetry: () => void;
}>;

type RelayRouteErrorBoundaryState = {
  readonly hasError: boolean;
};

class RelayRouteErrorBoundary extends React.Component<
  RelayRouteErrorBoundaryProps,
  RelayRouteErrorBoundaryState
> {
  state: RelayRouteErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): RelayRouteErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <ScreenState
          state="error"
          message={this.props.message}
          onRetry={this.props.onRetry}
        />
      );
    }

    return this.props.children;
  }
}
