import { graphql } from 'react-relay';

export type {
  contentSurfaceOperationsReportPostMutation as ContentSurfaceReportPostMutation,
} from '../__generated__/contentSurfaceOperationsReportPostMutation.graphql';

export const contentSurfacePostFields = graphql`
  fragment contentSurfaceOperationsPostFields on Post {
    id
    kind
    bodyText
    visibility
    expiresAt
    insertedAt
    author {
      id
      displayName
      email
      username
    }
    mediaAssets {
      id
      mimeType
      processingState
      publicUrl
    }
  }
`;

export const contentSurfaceLiveSessionFields = graphql`
  fragment contentSurfaceOperationsLiveSessionFields on LiveSession {
    id
    channelTopic
    status
    visibility
    insertedAt
    startedAt
    endedAt
    host {
      id
      displayName
      email
      username
    }
  }
`;

export const contentSurfaceReportPostMutation = graphql`
  mutation contentSurfaceOperationsReportPostMutation(
    $input: ReportPostInput!
  ) {
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
