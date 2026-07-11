import { graphql } from 'react-relay';

export type {
  postOwnerControlOperationsUpdatePostMutation as PostOwnerControlUpdatePostMutation,
} from '../__generated__/postOwnerControlOperationsUpdatePostMutation.graphql';
export type {
  postOwnerControlOperationsDeletePostMutation as PostOwnerControlDeletePostMutation,
} from '../__generated__/postOwnerControlOperationsDeletePostMutation.graphql';

/** Relay mutations shared by Home and profile content surfaces. */
export const postOwnerControlUpdatePostMutation = graphql`
  mutation postOwnerControlOperationsUpdatePostMutation(
    $input: UpdatePostInput!
  ) {
    updatePost(input: $input) {
      post {
        ...contentSurfaceOperationsPostFields @relay(mask: false)
      }
      errors {
        field
        message
      }
    }
  }
`;

export const postOwnerControlDeletePostMutation = graphql`
  mutation postOwnerControlOperationsDeletePostMutation(
    $input: DeletePostInput!
  ) {
    deletePost(input: $input) {
      deletedPostId @deleteRecord
      errors {
        field
        message
      }
    }
  }
`;
