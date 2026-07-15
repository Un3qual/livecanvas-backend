import { graphql } from 'react-relay';

export type {
  storyViewerOperationsQuery as StoryViewerOperationsQuery,
} from '../../__generated__/storyViewerOperationsQuery.graphql';

export const storyViewerPostFields = graphql`
  fragment storyViewerOperationsPostFields on Post {
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

export const storyViewerQuery = graphql`
  query storyViewerOperationsQuery(
    $id: ID!
    $storyAfter: String
    $storyFirst: Int!
  ) {
    viewer {
      id
    }
    node(id: $id) {
      __typename
      ... on Post {
        ...storyViewerOperationsPostFields @relay(mask: false)
        author {
          id
          email
          storyFeed(first: $storyFirst, after: $storyAfter) {
            edges {
              node {
                ...storyViewerOperationsPostFields @relay(mask: false)
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
  }
`;
