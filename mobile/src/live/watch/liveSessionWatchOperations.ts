import { graphql } from 'react-relay';

export type {
  liveSessionWatchOperationsEndMutation as LiveSessionWatchScreenEndMutation,
} from '../../__generated__/liveSessionWatchOperationsEndMutation.graphql';
export type {
  liveSessionWatchOperationsJoinMutation as LiveSessionWatchScreenJoinMutation,
} from '../../__generated__/liveSessionWatchOperationsJoinMutation.graphql';
export type {
  liveSessionWatchOperationsLeaveMutation as LiveSessionWatchScreenLeaveMutation,
} from '../../__generated__/liveSessionWatchOperationsLeaveMutation.graphql';
export type {
  liveSessionWatchOperationsPrepareMediaMutation as LiveSessionWatchScreenPrepareMediaMutation,
} from '../../__generated__/liveSessionWatchOperationsPrepareMediaMutation.graphql';
export type {
  liveSessionWatchOperationsQuery as LiveSessionWatchScreenQuery,
} from '../../__generated__/liveSessionWatchOperationsQuery.graphql';

export const liveSessionWatchScreenQuery = graphql`
  query liveSessionWatchOperationsQuery(
    $id: ID!
    $timelineLast: Int!
    $timelineBefore: String
  ) {
    viewer {
      id
    }
    node(id: $id) {
      __typename
      ... on LiveSession {
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
        recordingMediaAsset {
          id
          processingState
          publicUrl
        }
        timelineEvents(last: $timelineLast, before: $timelineBefore) {
          edges {
            cursor
            node {
              __typename
              id
              eventType
              occurredAt
              actor {
                id
              }
              ... on ChatMessageEvent {
                body
                edited
                editCount
                editedAt
              }
            }
          }
          pageInfo {
            startCursor
            endCursor
            hasNextPage
            hasPreviousPage
          }
        }
      }
    }
  }
`;

export const liveSessionWatchScreenJoinMutation = graphql`
  mutation liveSessionWatchOperationsJoinMutation(
    $input: JoinLiveSessionInput!
  ) {
    joinLiveSession(input: $input) {
      liveSession {
        id
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
      errors {
        field
        message
      }
    }
  }
`;

export const liveSessionWatchScreenPrepareMediaMutation = graphql`
  mutation liveSessionWatchOperationsPrepareMediaMutation(
    $input: PrepareLiveMediaSessionInput!
  ) {
    prepareLiveMediaSession(input: $input) {
      liveSession {
        id
        status
      }
      signalingTopic
      iceServers {
        urls
        username
        credential
        credentialType
      }
      errors {
        field
        message
      }
    }
  }
`;

export const liveSessionWatchScreenLeaveMutation = graphql`
  mutation liveSessionWatchOperationsLeaveMutation(
    $input: LeaveLiveSessionInput!
  ) {
    leaveLiveSession(input: $input) {
      left
      errors {
        field
        message
      }
    }
  }
`;

export const liveSessionWatchScreenEndMutation = graphql`
  mutation liveSessionWatchOperationsEndMutation($input: EndLiveSessionInput!) {
    endLiveSession(input: $input) {
      liveSession {
        id
        status
        endedAt
        channelTopic
      }
      errors {
        field
        message
      }
    }
  }
`;
