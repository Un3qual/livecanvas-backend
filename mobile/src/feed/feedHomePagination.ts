export type FeedHomePaginationSection = 'homeFeed' | 'replays' | 'stories';

export type FeedHomePaginationPageInfo = {
  readonly endCursor: string | null;
  readonly hasNextPage: boolean;
};

export type FeedHomeSectionPaginationState = {
  readonly error: string | null;
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
      readonly pageInfo: Record<
        FeedHomePaginationSection,
        FeedHomePaginationPageInfo
      >;
      readonly type: 'refresh_success';
    };

export const EMPTY_PAGE_INFO: FeedHomePaginationPageInfo = {
  endCursor: null,
  hasNextPage: false,
};

export function createFeedHomePaginationState(): FeedHomePaginationState {
  return {
    isRefreshing: false,
    refreshError: null,
    sections: {
      homeFeed: createSectionPaginationState(),
      replays: createSectionPaginationState(),
      stories: createSectionPaginationState(),
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
      return updateSection(state, action.section, (sectionState) => ({
        ...sectionState,
        error: action.message,
        isLoadingMore: false,
      }));

    case 'load_more_success':
      return updateSection(state, action.section, (sectionState) => ({
        ...sectionState,
        error: null,
        isLoadingMore: false,
        pageInfo: action.pageInfo,
      }));

    case 'refresh_start':
      return {
        ...state,
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
        isRefreshing: false,
        refreshError: null,
        sections: {
          homeFeed: {
            ...state.sections.homeFeed,
            pageInfo: action.pageInfo.homeFeed,
          },
          replays: {
            ...state.sections.replays,
            pageInfo: action.pageInfo.replays,
          },
          stories: {
            ...state.sections.stories,
            pageInfo: action.pageInfo.stories,
          },
        },
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

function createSectionPaginationState(): FeedHomeSectionPaginationState {
  return {
    error: null,
    isLoadingMore: false,
    pageInfo: EMPTY_PAGE_INFO,
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
