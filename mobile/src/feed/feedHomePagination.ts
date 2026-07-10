import {
  contentConnectionReducer,
  createContentConnectionState,
  selectContentRows,
  type ContentConnectionState,
} from '../content/contentConnectionState';
import type {
  ContentNode,
  ContentRequestIdentity,
} from '../content/contentSurfaceTypes';

export type FeedHomePaginationSection = 'homeFeed' | 'replays' | 'stories';

export type FeedHomePaginationPageInfo = {
  readonly endCursor: string | null;
  readonly hasNextPage: boolean;
};

export type FeedHomePaginationSectionInput = FeedHomePaginationPageInfo & {
  readonly basePageIdentity?: string;
  readonly rows?: ReadonlyArray<ContentNode>;
};

export type FeedHomePaginationState = {
  readonly connections: Record<
    FeedHomePaginationSection,
    ContentConnectionState<ContentNode>
  >;
  readonly isRefreshing: boolean;
  readonly refreshError: string | null;
};

export type FeedHomePaginationAction =
  | {
      readonly request: ContentRequestIdentity;
      readonly section: FeedHomePaginationSection;
      readonly type: 'load_more_start';
    }
  | {
      readonly message: string;
      readonly request: ContentRequestIdentity;
      readonly section: FeedHomePaginationSection;
      readonly type: 'load_more_error';
    }
  | {
      readonly pageInfo: FeedHomePaginationPageInfo;
      readonly request: ContentRequestIdentity;
      readonly rows: ReadonlyArray<ContentNode>;
      readonly section: FeedHomePaginationSection;
      readonly type: 'load_more_success';
    }
  | {
      readonly type: 'refresh_start';
    }
  | {
      readonly message: string;
      readonly type: 'refresh_error';
    }
  | {
      readonly sections: Record<
        FeedHomePaginationSection,
        FeedHomePaginationSectionInput
      >;
      readonly type: 'refresh_success';
    }
  | {
      readonly sections: Record<
        FeedHomePaginationSection,
        FeedHomePaginationSectionInput
      >;
      readonly type: 'query_page_info_sync';
    };

export type FeedHomeLoadMoreState = {
  readonly error: string | null;
  readonly isLoading: boolean;
};

const EMPTY_PAGE_INFO: FeedHomePaginationPageInfo = {
  endCursor: null,
  hasNextPage: false,
};

const HOME_ROUTE_GENERATION = 0;

export function createFeedHomePaginationState(sections: {
  readonly homeFeed?: FeedHomePaginationSectionInput | null;
  readonly replays?: FeedHomePaginationSectionInput | null;
  readonly stories?: FeedHomePaginationSectionInput | null;
}): FeedHomePaginationState {
  return {
    connections: {
      homeFeed: createConnectionState(sections.homeFeed),
      replays: createConnectionState(sections.replays),
      stories: createConnectionState(sections.stories),
    },
    isRefreshing: false,
    refreshError: null,
  };
}

export function feedHomePaginationReducer(
  state: FeedHomePaginationState,
  action: FeedHomePaginationAction,
): FeedHomePaginationState {
  switch (action.type) {
    case 'load_more_start':
      return updateConnection(
        state,
        action.section,
        contentConnectionReducer(state.connections[action.section], {
          request: action.request,
          type: 'load_more_start',
        }),
      );

    case 'load_more_error':
      return updateConnection(
        state,
        action.section,
        contentConnectionReducer(state.connections[action.section], {
          message: action.message,
          request: action.request,
          type: 'load_more_error',
        }),
      );

    case 'load_more_success':
      return updateConnection(
        state,
        action.section,
        contentConnectionReducer(state.connections[action.section], {
          pageInfo: action.pageInfo,
          request: action.request,
          rows: action.rows,
          type: 'load_more_success',
        }),
      );

    case 'refresh_start':
      return {
        ...state,
        connections: updateAllConnections(state.connections, (connection) => ({
          ...connection,
          activeRequest: null,
        })),
        isRefreshing: true,
        refreshError: null,
      };

    case 'refresh_error':
      return {
        ...state,
        isRefreshing: false,
        refreshError: action.message,
      };

    case 'refresh_success':
      return {
        ...state,
        connections: createConnections(action.sections),
        isRefreshing: false,
        refreshError: null,
      };

    case 'query_page_info_sync':
      return {
        ...state,
        connections: replaceBaseConnections(state.connections, action.sections),
      };

    default:
      return state;
  }
}

export function selectFeedHomeBasePageIdentity(
  state: FeedHomePaginationState,
  section: FeedHomePaginationSection,
): string {
  return state.connections[section].basePageIdentity;
}

export function selectFeedHomeLoadMoreState(
  state: FeedHomePaginationState,
  section: FeedHomePaginationSection,
): FeedHomeLoadMoreState {
  const connection = state.connections[section];

  return {
    error: connection.error,
    isLoading: connection.activeRequest !== null,
  };
}

export function selectFeedHomePageInfo(
  state: FeedHomePaginationState,
  section: FeedHomePaginationSection,
): FeedHomePaginationPageInfo {
  return state.connections[section].pageInfo;
}

export function selectFeedHomeRows<Node extends ContentNode>(
  state: FeedHomePaginationState,
  section: FeedHomePaginationSection,
): Node[] {
  return selectContentRows(state.connections[section]) as Node[];
}

function createConnectionState(
  input?: FeedHomePaginationSectionInput | null,
): ContentConnectionState<ContentNode> {
  return createContentConnectionState({
    basePageIdentity: basePageIdentityFromInput(input),
    baseRows: input?.rows ?? [],
    pageInfo: pageInfoFromInput(input),
    routeGeneration: HOME_ROUTE_GENERATION,
  });
}

function createConnections(
  sections: Record<
    FeedHomePaginationSection,
    FeedHomePaginationSectionInput
  >,
): FeedHomePaginationState['connections'] {
  return {
    homeFeed: createConnectionState(sections.homeFeed),
    replays: createConnectionState(sections.replays),
    stories: createConnectionState(sections.stories),
  };
}

function replaceBaseConnections(
  connections: FeedHomePaginationState['connections'],
  sections: Record<
    FeedHomePaginationSection,
    FeedHomePaginationSectionInput
  >,
): FeedHomePaginationState['connections'] {
  return updateAllConnections(connections, (connection, section) =>
    contentConnectionReducer(connection, {
      basePageIdentity: basePageIdentityFromInput(sections[section]),
      baseRows: sections[section].rows ?? [],
      pageInfo: pageInfoFromInput(sections[section]),
      routeGeneration: HOME_ROUTE_GENERATION,
      type: 'replace_base',
    }),
  );
}

function pageInfoFromInput(
  pageInfo?: FeedHomePaginationSectionInput | null,
): FeedHomePaginationPageInfo {
  return pageInfo
    ? {
        endCursor: pageInfo.endCursor,
        hasNextPage: pageInfo.hasNextPage,
      }
    : EMPTY_PAGE_INFO;
}

function basePageIdentityFromInput(
  pageInfo?: FeedHomePaginationSectionInput | null,
): string {
  return pageInfo?.basePageIdentity ?? '';
}

function updateAllConnections(
  connections: FeedHomePaginationState['connections'],
  update: (
    connection: ContentConnectionState<ContentNode>,
    section: FeedHomePaginationSection,
  ) => ContentConnectionState<ContentNode>,
): FeedHomePaginationState['connections'] {
  return {
    homeFeed: update(connections.homeFeed, 'homeFeed'),
    replays: update(connections.replays, 'replays'),
    stories: update(connections.stories, 'stories'),
  };
}

function updateConnection(
  state: FeedHomePaginationState,
  section: FeedHomePaginationSection,
  connection: ContentConnectionState<ContentNode>,
): FeedHomePaginationState {
  if (connection === state.connections[section]) {
    return state;
  }

  return {
    ...state,
    connections: {
      ...state.connections,
      [section]: connection,
    },
  };
}
