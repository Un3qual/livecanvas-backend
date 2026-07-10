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

export type FeedHomeSectionPaginationState = {
  readonly error: string | null;
  readonly hasLoadedMore: boolean;
  readonly isLoadingMore: boolean;
  readonly pageInfo: FeedHomePaginationPageInfo;
};

export type FeedHomePaginationState = {
  readonly connections: Record<
    FeedHomePaginationSection,
    ContentConnectionState<ContentNode>
  >;
  readonly isRefreshing: boolean;
  readonly refreshError: string | null;
  readonly sectionBasePageIdentities: Record<FeedHomePaginationSection, string>;
  readonly sections: Record<
    FeedHomePaginationSection,
    FeedHomeSectionPaginationState
  >;
};

export type FeedHomePaginationAction =
  | {
      readonly request?: ContentRequestIdentity;
      readonly section: FeedHomePaginationSection;
      readonly type: 'load_more_start';
    }
  | {
      readonly message: string;
      readonly request?: ContentRequestIdentity;
      readonly section: FeedHomePaginationSection;
      readonly type: 'load_more_error';
    }
  | {
      readonly basePageIdentity?: string;
      readonly pageInfo: FeedHomePaginationPageInfo;
      readonly request?: ContentRequestIdentity;
      readonly rows?: ReadonlyArray<ContentNode>;
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
    sectionBasePageIdentities: {
      homeFeed: basePageIdentityFromInput(sections.homeFeed),
      replays: basePageIdentityFromInput(sections.replays),
      stories: basePageIdentityFromInput(sections.stories),
    },
    sections: {
      homeFeed: createSectionState(sections.homeFeed),
      replays: createSectionState(sections.replays),
      stories: createSectionState(sections.stories),
    },
  };
}

export function feedHomePaginationReducer(
  state: FeedHomePaginationState,
  action: FeedHomePaginationAction,
): FeedHomePaginationState {
  switch (action.type) {
    case 'load_more_start': {
      const connection = state.connections[action.section];
      const request = action.request ?? legacyRequest(connection, action.section);
      const nextConnection = request
        ? contentConnectionReducer(connection, {
            request,
            type: 'load_more_start',
          })
        : connection;

      return updateSection(
        state,
        action.section,
        nextConnection,
        (sectionState) => ({
          ...sectionState,
          error: null,
          isLoadingMore: true,
        }),
      );
    }

    case 'load_more_error': {
      const connection = state.connections[action.section];
      const request = action.request ?? connection.activeRequest;
      const nextConnection = request
        ? contentConnectionReducer(connection, {
            message: action.message,
            request,
            type: 'load_more_error',
          })
        : connection;

      return updateSection(
        state,
        action.section,
        nextConnection,
        (sectionState) =>
          sectionState.isLoadingMore
            ? {
                ...sectionState,
                error: action.message,
                isLoadingMore: false,
              }
            : sectionState,
      );
    }

    case 'load_more_success': {
      if (
        state.sectionBasePageIdentities[action.section] !==
        (action.basePageIdentity ??
          state.sectionBasePageIdentities[action.section])
      ) {
        return state;
      }

      const connection = state.connections[action.section];
      const request = action.request ?? connection.activeRequest;
      const nextConnection = request
        ? contentConnectionReducer(connection, {
            pageInfo: action.pageInfo,
            request,
            rows: action.rows ?? [],
            type: 'load_more_success',
          })
        : connection;

      return updateSection(
        state,
        action.section,
        nextConnection,
        (sectionState) =>
          sectionState.isLoadingMore
            ? {
                ...sectionState,
                error: null,
                hasLoadedMore: true,
                isLoadingMore: false,
                pageInfo: action.pageInfo,
              }
            : sectionState,
      );
    }

    case 'refresh_start':
      return {
        ...state,
        connections: updateAllConnections(state.connections, (connection) => ({
          ...connection,
          activeRequest: null,
        })),
        isRefreshing: true,
        refreshError: null,
        sections: updateAllSections(state.sections, (sectionState) => ({
          ...sectionState,
          isLoadingMore: false,
        })),
      };

    case 'refresh_error':
      return {
        ...state,
        isRefreshing: false,
        refreshError: action.message,
      };

    case 'refresh_success':
      return createRefreshedState(state, action.sections);

    case 'query_page_info_sync':
      return syncQuerySections(state, action.sections);

    default:
      return state;
  }
}

export function selectFeedHomePageInfo(
  state: FeedHomePaginationState,
  section: FeedHomePaginationSection,
): FeedHomePaginationPageInfo {
  return state.sections[section].pageInfo;
}

export function selectFeedHomeRows<Node extends ContentNode>(
  state: FeedHomePaginationState,
  section: FeedHomePaginationSection,
): Node[] {
  return selectContentRows(state.connections[section]) as Node[];
}

function createRefreshedState(
  state: FeedHomePaginationState,
  sections: Record<
    FeedHomePaginationSection,
    FeedHomePaginationSectionInput
  >,
): FeedHomePaginationState {
  const nextConnections = updateAllConnections(
    state.connections,
    (connection, section) =>
      contentConnectionReducer(connection, {
        basePageIdentity: basePageIdentityFromInput(sections[section]),
        baseRows: sections[section].rows ?? [],
        pageInfo: pageInfoFromInput(sections[section]),
        routeGeneration: HOME_ROUTE_GENERATION,
        type: 'replace_base',
      }),
  );

  return {
    ...state,
    connections: nextConnections,
    isRefreshing: false,
    refreshError: null,
    sectionBasePageIdentities: {
      homeFeed: basePageIdentityFromInput(sections.homeFeed),
      replays: basePageIdentityFromInput(sections.replays),
      stories: basePageIdentityFromInput(sections.stories),
    },
    sections: updateAllSections(state.sections, (_sectionState, section) => {
      const connection = nextConnections[section];

      return connection.extraRows.length > 0
        ? {
            error: null,
            hasLoadedMore: true,
            isLoadingMore: false,
            pageInfo: connection.pageInfo,
          }
        : createSectionState(sections[section]);
    }),
  };
}

function syncQuerySections(
  state: FeedHomePaginationState,
  sections: Record<
    FeedHomePaginationSection,
    FeedHomePaginationSectionInput
  >,
): FeedHomePaginationState {
  const nextConnections = updateAllConnections(
    state.connections,
    (connection, section) =>
      contentConnectionReducer(connection, {
        basePageIdentity: basePageIdentityFromInput(sections[section]),
        baseRows: sections[section].rows ?? [],
        pageInfo: pageInfoFromInput(sections[section]),
        routeGeneration: HOME_ROUTE_GENERATION,
        type: 'replace_base',
      }),
  );

  return {
    ...state,
    connections: nextConnections,
    sectionBasePageIdentities: {
      homeFeed: basePageIdentityFromInput(sections.homeFeed),
      replays: basePageIdentityFromInput(sections.replays),
      stories: basePageIdentityFromInput(sections.stories),
    },
    sections: updateAllSections(state.sections, (sectionState, section) =>
      syncSectionPageInfo(
        sectionState,
        state.sectionBasePageIdentities[section],
        sections[section],
      ),
    ),
  };
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

function createSectionState(
  pageInfo?: FeedHomePaginationSectionInput | null,
): FeedHomeSectionPaginationState {
  return {
    error: null,
    hasLoadedMore: false,
    isLoadingMore: false,
    pageInfo: pageInfoFromInput(pageInfo),
  };
}

function syncSectionPageInfo(
  sectionState: FeedHomeSectionPaginationState,
  currentBasePageIdentity: string,
  pageInfo: FeedHomePaginationSectionInput,
): FeedHomeSectionPaginationState {
  if (currentBasePageIdentity !== basePageIdentityFromInput(pageInfo)) {
    return createSectionState(pageInfo);
  }

  return sectionState.hasLoadedMore
    ? sectionState
    : {
        ...sectionState,
        error: null,
        pageInfo: pageInfoFromInput(pageInfo),
      };
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

function legacyRequest(
  connection: ContentConnectionState<ContentNode>,
  section: FeedHomePaginationSection,
): ContentRequestIdentity | null {
  return connection.pageInfo.endCursor
    ? {
        cursor: connection.pageInfo.endCursor,
        key: `home:${section}:legacy:${connection.pageInfo.endCursor}`,
        routeGeneration: HOME_ROUTE_GENERATION,
      }
    : null;
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

function updateAllSections(
  sections: FeedHomePaginationState['sections'],
  update: (
    sectionState: FeedHomeSectionPaginationState,
    section: FeedHomePaginationSection,
  ) => FeedHomeSectionPaginationState,
): FeedHomePaginationState['sections'] {
  return {
    homeFeed: update(sections.homeFeed, 'homeFeed'),
    replays: update(sections.replays, 'replays'),
    stories: update(sections.stories, 'stories'),
  };
}

function updateSection(
  state: FeedHomePaginationState,
  section: FeedHomePaginationSection,
  connection: ContentConnectionState<ContentNode>,
  update: (
    sectionState: FeedHomeSectionPaginationState,
  ) => FeedHomeSectionPaginationState,
): FeedHomePaginationState {
  return {
    ...state,
    connections: {
      ...state.connections,
      [section]: connection,
    },
    sections: {
      ...state.sections,
      [section]: update(state.sections[section]),
    },
  };
}
