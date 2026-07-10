import { graphql } from 'react-relay';

import type { ProfileContentKind } from '../content/contentSurfaceTypes';
import type { profileContentOperationsQuery as ProfileContentQuery } from '../__generated__/profileContentOperationsQuery.graphql';

type ProfileContentData = ProfileContentQuery['response'];
type ProfileContentNode = ProfileContentData['node'];
type ProfileContentUser = Extract<
  NonNullable<ProfileContentNode>,
  { readonly __typename: 'User' }
>;

export type ProfilePostConnection = NonNullable<ProfileContentUser['posts']>;
export type ProfileReplayConnection = NonNullable<
  ProfileContentUser['replayFeed']
>;

export type { ProfileContentQuery };

export const profileContentQuery = graphql`
  query profileContentOperationsQuery(
    $after: String
    $first: Int!
    $id: ID!
    $includePosts: Boolean!
    $includeReplays: Boolean!
    $includeStories: Boolean!
  ) {
    viewer {
      id
    }
    node(id: $id) {
      __typename
      ... on User {
        id
        posts(first: $first, after: $after) @include(if: $includePosts) {
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
        storyFeed(first: $first, after: $after)
          @include(if: $includeStories) {
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
        replayFeed(first: $first, after: $after)
          @include(if: $includeReplays) {
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
    }
  }
`;

export function profileContentVariables(
  profileId: string,
  kind: ProfileContentKind,
  first: number,
  after: string | null,
): ProfileContentQuery['variables'] {
  return {
    after,
    first,
    id: profileId,
    includePosts: kind === 'posts',
    includeReplays: kind === 'replays',
    includeStories: kind === 'stories',
  };
}

export function selectProfileContentConnection(
  data: ProfileContentData,
  kind: 'posts' | 'stories',
): ProfilePostConnection | null;
export function selectProfileContentConnection(
  data: ProfileContentData,
  kind: 'replays',
): ProfileReplayConnection | null;
export function selectProfileContentConnection(
  data: ProfileContentData,
  kind: ProfileContentKind,
): ProfilePostConnection | ProfileReplayConnection | null {
  if (data.node?.__typename !== 'User') {
    return null;
  }

  switch (kind) {
    case 'posts':
      return data.node.posts ?? null;

    case 'stories':
      return data.node.storyFeed ?? null;

    case 'replays':
      return data.node.replayFeed ?? null;

    default:
      return assertNever(kind);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled profile content kind: ${String(value)}`);
}
