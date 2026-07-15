import { graphql } from 'react-relay';

export type {
  profileConnectionOperationsViewerFollowersQuery as ViewerFollowersQuery,
} from '../__generated__/profileConnectionOperationsViewerFollowersQuery.graphql';
export type {
  profileConnectionOperationsViewerFollowingQuery as ViewerFollowingQuery,
} from '../__generated__/profileConnectionOperationsViewerFollowingQuery.graphql';
export type {
  profileConnectionOperationsOtherFollowersQuery as OtherFollowersQuery,
} from '../__generated__/profileConnectionOperationsOtherFollowersQuery.graphql';
export type {
  profileConnectionOperationsOtherFollowingQuery as OtherFollowingQuery,
} from '../__generated__/profileConnectionOperationsOtherFollowingQuery.graphql';
export type {
  profileConnectionOperationsPendingRequestsQuery as PendingRequestsQuery,
} from '../__generated__/profileConnectionOperationsPendingRequestsQuery.graphql';
export type {
  profileConnectionOperationsAcceptFollowRequestMutation as ProfileConnectionAcceptFollowRequestMutation,
} from '../__generated__/profileConnectionOperationsAcceptFollowRequestMutation.graphql';
export type {
  profileConnectionOperationsDeclineFollowRequestMutation as ProfileConnectionDeclineFollowRequestMutation,
} from '../__generated__/profileConnectionOperationsDeclineFollowRequestMutation.graphql';

export const PROFILE_CONNECTION_QUERY_VARIABLES = {
  after: null,
  first: 20,
} as const;

export const profileConnectionUserFields = graphql`
  fragment profileConnectionOperationsUserFields on User {
    id
    displayName
    email
    privacyMode
    username
  }
`;

export const viewerFollowersQuery = graphql`
  query profileConnectionOperationsViewerFollowersQuery(
    $after: String
    $first: Int!
  ) {
    viewer {
      id
      followers(first: $first, after: $after) {
        edges {
          node {
            ...profileConnectionOperationsUserFields @relay(mask: false)
          }
        }
        pageInfo {
          endCursor
          hasNextPage
        }
      }
    }
  }
`;

export const viewerFollowingQuery = graphql`
  query profileConnectionOperationsViewerFollowingQuery(
    $after: String
    $first: Int!
  ) {
    viewer {
      id
      following(first: $first, after: $after) {
        edges {
          node {
            ...profileConnectionOperationsUserFields @relay(mask: false)
          }
        }
        pageInfo {
          endCursor
          hasNextPage
        }
      }
    }
  }
`;

export const otherFollowersQuery = graphql`
  query profileConnectionOperationsOtherFollowersQuery(
    $after: String
    $first: Int!
    $id: ID!
  ) {
    node(id: $id) {
      __typename
      ... on User {
        id
        followers(first: $first, after: $after) {
          edges {
            node {
              ...profileConnectionOperationsUserFields @relay(mask: false)
            }
          }
          pageInfo {
            endCursor
            hasNextPage
          }
        }
      }
    }
  }
`;

export const otherFollowingQuery = graphql`
  query profileConnectionOperationsOtherFollowingQuery(
    $after: String
    $first: Int!
    $id: ID!
  ) {
    node(id: $id) {
      __typename
      ... on User {
        id
        following(first: $first, after: $after) {
          edges {
            node {
              ...profileConnectionOperationsUserFields @relay(mask: false)
            }
          }
          pageInfo {
            endCursor
            hasNextPage
          }
        }
      }
    }
  }
`;

export const pendingRequestsQuery = graphql`
  query profileConnectionOperationsPendingRequestsQuery(
    $after: String
    $first: Int!
  ) {
    viewerPendingFollowRequests(first: $first, after: $after) {
      edges {
        node {
          id
          state
          requestedAt
          follower {
            ...profileConnectionOperationsUserFields @relay(mask: false)
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

export const acceptFollowRequestMutation = graphql`
  mutation profileConnectionOperationsAcceptFollowRequestMutation(
    $input: AcceptFollowRequestInput!
  ) {
    acceptFollowRequest(input: $input) {
      follow {
        id
        state
      }
      errors {
        field
        message
      }
    }
  }
`;

export const declineFollowRequestMutation = graphql`
  mutation profileConnectionOperationsDeclineFollowRequestMutation(
    $input: DeclineFollowRequestInput!
  ) {
    declineFollowRequest(input: $input) {
      errors {
        field
        message
      }
    }
  }
`;
