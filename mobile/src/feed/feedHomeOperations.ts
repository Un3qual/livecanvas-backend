import { graphql } from 'react-relay';

export type {
  feedHomeOperationsQuery as FeedHomeScreenQuery,
} from '../__generated__/feedHomeOperationsQuery.graphql';
export type {
  feedHomeOperationsReportPostMutation as FeedHomeScreenReportPostMutation,
} from '../__generated__/feedHomeOperationsReportPostMutation.graphql';

export const FEED_HOME_QUERY_VARIABLES = {
  feedAfter: null,
  feedFirst: 10,
  liveFirst: 20,
  replayAfter: null,
  replayFirst: 10,
  storyAfter: null,
  storyFirst: 10,
} as const;

export const feedHomeOperationsPostFields = graphql`
  fragment feedHomeOperationsPostFields on Post {
    id
    kind
    bodyText
    visibility
    expiresAt
    insertedAt
    author {
      id
      email
    }
    mediaAssets {
      id
      mimeType
      processingState
      publicUrl
    }
  }
`;

export const feedHomeOperationsLiveSessionFields = graphql`
  fragment feedHomeOperationsLiveSessionFields on LiveSession {
    id
    channelTopic
    status
    visibility
    insertedAt
    startedAt
    endedAt
    host {
      id
      email
    }
  }
`;

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
        ...feedHomeOperationsLiveSessionFields @relay(mask: false)
      }
    }
    storyFeed(first: $storyFirst, after: $storyAfter) {
      edges {
        node {
          ...feedHomeOperationsPostFields @relay(mask: false)
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
          ...feedHomeOperationsPostFields @relay(mask: false)
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
          ...feedHomeOperationsLiveSessionFields @relay(mask: false)
        }
      }
    }
    replayFeed(first: $replayFirst, after: $replayAfter) {
      edges {
        node {
          ...feedHomeOperationsLiveSessionFields @relay(mask: false)
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`;

export const feedHomeScreenReportPostMutation = graphql`
  mutation feedHomeOperationsReportPostMutation($input: ReportPostInput!) {
    reportPost(input: $input) {
      report {
        id
        postId
        reason
        status
        insertedAt
      }
      errors {
        field
        message
      }
    }
  }
`;
