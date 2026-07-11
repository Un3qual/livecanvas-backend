import type {
  ContentNode,
  ContentPageInfo,
  ContentRequestIdentity,
} from './contentSurfaceTypes';

export type ContentConnectionState<Node extends ContentNode> = {
  readonly activeRequest: ContentRequestIdentity | null;
  readonly basePageIdentity: string;
  readonly baseRows: ReadonlyArray<Node>;
  readonly error: string | null;
  readonly extraRows: ReadonlyArray<Node>;
  readonly pageInfo: ContentPageInfo;
  readonly routeGeneration: number;
};

export type ContentConnectionAction<Node extends ContentNode> =
  | {
      readonly request: ContentRequestIdentity;
      readonly type: 'load_more_start';
    }
  | {
      readonly message: string;
      readonly request: ContentRequestIdentity;
      readonly type: 'load_more_error';
    }
  | {
      readonly pageInfo: ContentPageInfo;
      readonly request: ContentRequestIdentity;
      readonly rows: ReadonlyArray<Node>;
      readonly type: 'load_more_success';
    }
  | {
      readonly basePageIdentity: string;
      readonly baseRows: ReadonlyArray<Node>;
      readonly pageInfo: ContentPageInfo;
      readonly routeGeneration: number;
      readonly type: 'replace_base';
    };

export function createContentConnectionState<Node extends ContentNode>({
  basePageIdentity,
  baseRows,
  pageInfo,
  routeGeneration,
}: {
  readonly basePageIdentity: string;
  readonly baseRows: ReadonlyArray<Node>;
  readonly pageInfo: ContentPageInfo;
  readonly routeGeneration: number;
}): ContentConnectionState<Node> {
  return {
    activeRequest: null,
    basePageIdentity,
    baseRows,
    error: null,
    extraRows: [],
    pageInfo,
    routeGeneration,
  };
}

export function contentConnectionReducer<Node extends ContentNode>(
  state: ContentConnectionState<Node>,
  action: ContentConnectionAction<Node>,
): ContentConnectionState<Node> {
  switch (action.type) {
    case 'load_more_start':
      if (
        state.activeRequest !== null ||
        !state.pageInfo.hasNextPage ||
        state.pageInfo.endCursor !== action.request.cursor ||
        state.routeGeneration !== action.request.routeGeneration
      ) {
        return state;
      }

      return {
        ...state,
        activeRequest: action.request,
        error: null,
      };

    case 'load_more_error':
      if (!isActiveRequest(state, action.request)) {
        return state;
      }

      return {
        ...state,
        activeRequest: null,
        error: action.message,
      };

    case 'load_more_success':
      if (!isActiveRequest(state, action.request)) {
        return state;
      }

      return {
        ...state,
        activeRequest: null,
        error: null,
        extraRows: appendUniqueContentRows(state.extraRows, action.rows),
        pageInfo: action.pageInfo,
      };

    case 'replace_base':
      if (
        state.basePageIdentity !== action.basePageIdentity ||
        state.routeGeneration !== action.routeGeneration
      ) {
        return createContentConnectionState(action);
      }

      return {
        ...state,
        baseRows: action.baseRows,
        error: null,
        pageInfo:
          state.extraRows.length > 0 ? state.pageInfo : action.pageInfo,
      };

    default:
      return state;
  }
}

export function selectContentRows<Node extends ContentNode>(
  state: ContentConnectionState<Node>,
): Node[] {
  return appendUniqueContentRows(state.baseRows, state.extraRows);
}

export function appendUniqueContentRows<Node extends ContentNode>(
  current: ReadonlyArray<Node>,
  incoming: ReadonlyArray<Node>,
): Node[] {
  const seenIds = new Set<string>();
  const rows: Node[] = [];

  for (const row of current.concat(incoming)) {
    if (seenIds.has(row.id)) {
      continue;
    }

    seenIds.add(row.id);
    rows.push(row);
  }

  return rows;
}

function isActiveRequest<Node extends ContentNode>(
  state: ContentConnectionState<Node>,
  request: ContentRequestIdentity,
): boolean {
  return (
    state.activeRequest === request &&
    state.routeGeneration === request.routeGeneration
  );
}
