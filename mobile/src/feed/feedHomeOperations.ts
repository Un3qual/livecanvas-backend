import { graphql } from 'react-relay';

export type {
  feedHomeOperationsQuery as FeedHomeScreenQuery,
} from '../__generated__/feedHomeOperationsQuery.graphql';

export const FEED_HOME_QUERY_VARIABLES = {
  feedAfter: null,
  feedFirst: 10,
  liveFirst: 20,
  replayAfter: null,
  replayFirst: 10,
  storyAfter: null,
  storyFirst: 10,
} as const;

export const feedHomeScreenQuery = graphql`
  query feedHomeOperationsQuery(
    $feedAfter: String
    $feedFirst: Int!
    $liveFirst: Int!
    $replayAfter: String
    $replayFirst: Int!
    $storyAfter: String
    $storyFirst: Int!
  ) {
    viewer {
      id
      currentLiveSession {
        ...contentSurfaceOperationsLiveSessionFields @relay(mask: false)
      }
    }
    storyFeed(first: $storyFirst, after: $storyAfter) {
      edges {
        node {
          ...contentSurfaceOperationsPostFields @relay(mask: false)
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
    homeFeed(first: $feedFirst, after: $feedAfter) {
      edges {
        node {
          ...contentSurfaceOperationsPostFields @relay(mask: false)
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
    liveNow(first: $liveFirst) {
      edges {
        node {
          ...contentSurfaceOperationsLiveSessionFields @relay(mask: false)
        }
      }
    }
    replayFeed(first: $replayFirst, after: $replayAfter) {
      edges {
        node {
          ...contentSurfaceOperationsLiveSessionFields @relay(mask: false)
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`;
