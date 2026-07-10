import { graphql } from 'react-relay';

export const accountSettingsQuery = graphql`
  query accountSettingsOperationsQuery {
    viewer {
      id
      email
      userIdentities(first: 20) {
        edges {
          node {
            id
            provider
            authProvider
            canUnlink
            insertedAt
          }
        }
      }
    }
    viewerDataExportRequests(first: 20) {
      edges {
        node {
          id
          status
          format
          requestedAt
          completedAt
          failureReason
        }
      }
    }
    viewerAccountDeletionRequests(first: 20) {
      edges {
        node {
          id
          status
          requestedAt
          scheduledPurgeAt
          completedAt
          failureReason
        }
      }
    }
  }
`;

export const accountSettingsUnlinkIdentityMutation = graphql`
  mutation accountSettingsOperationsUnlinkIdentityMutation(
    $input: UnlinkViewerIdentityInput!
  ) {
    unlinkViewerIdentity(input: $input) {
      userIdentity {
        id
      }
      errors {
        field
        message
      }
    }
  }
`;

export const accountSettingsRequestDataExportMutation = graphql`
  mutation accountSettingsOperationsRequestDataExportMutation(
    $input: RequestViewerDataExportInput!
  ) {
    requestViewerDataExport(input: $input) {
      dataExportRequest {
        id
        status
        format
        requestedAt
        completedAt
        failureReason
      }
      errors {
        field
        message
      }
    }
  }
`;

export const accountSettingsRequestAccountDeletionMutation = graphql`
  mutation accountSettingsOperationsRequestAccountDeletionMutation(
    $input: RequestViewerAccountDeletionInput!
  ) {
    requestViewerAccountDeletion(input: $input) {
      accountDeletionRequest {
        id
        status
        requestedAt
        scheduledPurgeAt
        completedAt
        failureReason
      }
      errors {
        field
        message
      }
    }
  }
`;

export const accountSettingsCancelAccountDeletionMutation = graphql`
  mutation accountSettingsOperationsCancelAccountDeletionMutation(
    $input: CancelViewerAccountDeletionRequestInput!
  ) {
    cancelViewerAccountDeletionRequest(input: $input) {
      accountDeletionRequest {
        id
        status
        requestedAt
        scheduledPurgeAt
        completedAt
        failureReason
      }
      errors {
        field
        message
      }
    }
  }
`;
