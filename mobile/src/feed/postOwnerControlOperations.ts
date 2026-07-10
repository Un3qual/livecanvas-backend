import { graphql } from 'react-relay';

export type {
  postOwnerControlOperationsUpdatePostMutation as PostOwnerControlUpdatePostMutation,
} from '../__generated__/postOwnerControlOperationsUpdatePostMutation.graphql';
export type {
  postOwnerControlOperationsDeletePostMutation as PostOwnerControlDeletePostMutation,
} from '../__generated__/postOwnerControlOperationsDeletePostMutation.graphql';

export const postOwnerControlUpdatePostMutation = graphql`
  mutation postOwnerControlOperationsUpdatePostMutation(
    $input: UpdatePostInput!
  ) {
    updatePost(input: $input) {
      post {
        ...feedHomeOperationsPostFields @relay(mask: false)
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
      deletedPostId
      errors {
        field
        message
      }
    }
  }
`;
