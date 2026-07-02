import { graphql } from 'react-relay';

export type {
  postComposerOperationsCreatePostMutation as PostComposerCreatePostMutation,
} from '../__generated__/postComposerOperationsCreatePostMutation.graphql';

export const postComposerCreatePostMutation = graphql`
  mutation postComposerOperationsCreatePostMutation(
    $input: CreatePostInput!
  ) {
    createPost(input: $input) {
      post {
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
      errors {
        field
        message
      }
    }
  }
`;
