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
    }
    storyFeed(first: $storyFirst, after: $storyAfter) {
      edges {
        node {
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
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
    homeFeed(first: $feedFirst, after: $feedAfter) {
      edges {
        node {
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
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
    liveNow(first: $liveFirst) {
      edges {
        node {
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
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
    replayFeed(first: $replayFirst, after: $replayAfter) {
      edges {
        node {
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
