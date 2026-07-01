export type FeedHomePaginationSection = 'homeFeed' | 'replays' | 'stories';

export type FeedHomePaginationPageInfo = {
  readonly endCursor: string | null;
  readonly hasNextPage: boolean;
};

export type FeedHomeSectionPaginationState = {
  readonly error: string | null;
  readonly hasLoadedMore: boolean;
  readonly isLoadingMore: boolean;
  readonly pageInfo: FeedHomePaginationPageInfo;
};

export type FeedHomePaginationState = {
  readonly isRefreshing: boolean;
  readonly refreshError: string | null;
  readonly sections: Record<
    FeedHomePaginationSection,
    FeedHomeSectionPaginationState
  >;
};

export type FeedHomePaginationAction =
  | {
      readonly section: FeedHomePaginationSection;
      readonly type: 'load_more_start';
    }
  | {
      readonly message: string;
      readonly section: FeedHomePaginationSection;
      readonly type: 'load_more_error';
    }
  | {
      readonly pageInfo: FeedHomePaginationPageInfo;
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
        FeedHomePaginationPageInfo
      >;
      readonly type: 'refresh_success';
    }
  | {
      readonly sections: Record<
        FeedHomePaginationSection,
        FeedHomePaginationPageInfo
      >;
      readonly type: 'query_page_info_sync';
    };

const EMPTY_PAGE_INFO: FeedHomePaginationPageInfo = {
  endCursor: null,
  hasNextPage: false,
};

export function createFeedHomePaginationState(sections: {
  readonly homeFeed?: FeedHomePaginationPageInfo | null;
  readonly replays?: FeedHomePaginationPageInfo | null;
  readonly stories?: FeedHomePaginationPageInfo | null;
}): FeedHomePaginationState {
  return {
    isRefreshing: false,
    refreshError: null,
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
    case 'load_more_start':
      return updateSection(state, action.section, (sectionState) => ({
        ...sectionState,
        error: null,
        isLoadingMore: true,
      }));

    case 'load_more_error':
      return updateSection(state, action.section, (sectionState) =>
        sectionState.isLoadingMore
          ? {
              ...sectionState,
              error: action.message,
              isLoadingMore: false,
            }
          : sectionState,
      );

    case 'load_more_success':
      return updateSection(state, action.section, (sectionState) =>
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

    case 'refresh_start':
      return {
        ...state,
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
      return {
        ...state,
        isRefreshing: false,
        refreshError: null,
        sections: {
          homeFeed: createSectionState(action.sections.homeFeed),
          replays: createSectionState(action.sections.replays),
          stories: createSectionState(action.sections.stories),
        },
      };

    case 'query_page_info_sync':
      return {
        ...state,
        sections: updateAllSections(state.sections, (sectionState, section) =>
          sectionState.hasLoadedMore
            ? sectionState
            : {
                ...sectionState,
                isLoadingMore: false,
                pageInfo: action.sections[section],
              },
        ),
      };

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

function createSectionState(
  pageInfo?: FeedHomePaginationPageInfo | null,
): FeedHomeSectionPaginationState {
  return {
    error: null,
    hasLoadedMore: false,
    isLoadingMore: false,
    pageInfo: pageInfo ?? EMPTY_PAGE_INFO,
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
  update: (
    sectionState: FeedHomeSectionPaginationState,
  ) => FeedHomeSectionPaginationState,
): FeedHomePaginationState {
  return {
    ...state,
    sections: {
      ...state.sections,
      [section]: update(state.sections[section]),
    },
  };
}
