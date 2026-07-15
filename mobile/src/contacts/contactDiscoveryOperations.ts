import { graphql } from 'react-relay';

export type {
  contactDiscoveryOperationsQuery as ContactDiscoveryQuery,
} from '../__generated__/contactDiscoveryOperationsQuery.graphql';
export type {
  contactDiscoveryOperationsUpsertMutation as ContactDiscoveryUpsertMutation,
} from '../__generated__/contactDiscoveryOperationsUpsertMutation.graphql';
export type {
  contactDiscoveryOperationsDeliverInviteMutation as ContactDiscoveryDeliverInviteMutation,
} from '../__generated__/contactDiscoveryOperationsDeliverInviteMutation.graphql';
export type {
  contactDiscoveryOperationsImportMutation as ContactDiscoveryImportMutation,
} from '../__generated__/contactDiscoveryOperationsImportMutation.graphql';

export const CONTACT_DISCOVERY_QUERY_VARIABLES = {
  after: null,
  first: 20,
} as const;

export const contactDiscoveryContactMatchFields = graphql`
  fragment contactDiscoveryOperationsContactMatchFields on ContactMatch {
    id
    contactName
    inviteRecipient
    matchedUsers {
      id
      email
      privacyMode
    }
  }
`;

export const contactDiscoveryQuery = graphql`
  query contactDiscoveryOperationsQuery($after: String, $first: Int!) {
    viewerContactMatches(first: $first, after: $after) {
      edges {
        node {
          ...contactDiscoveryOperationsContactMatchFields @relay(mask: false)
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`;

export const contactDiscoveryUpsertMutation = graphql`
  mutation contactDiscoveryOperationsUpsertMutation(
    $input: UpsertViewerContactEntryInput!
  ) {
    upsertViewerContactEntry(input: $input) {
      contactMatch {
        ...contactDiscoveryOperationsContactMatchFields @relay(mask: false)
      }
      errors {
        field
        message
      }
    }
  }
`;

export const contactDiscoveryDeliverInviteMutation = graphql`
  mutation contactDiscoveryOperationsDeliverInviteMutation(
    $input: DeliverViewerContactInviteInput!
  ) {
    deliverViewerContactInvite(input: $input) {
      errors {
        field
        message
      }
    }
  }
`;

export const contactDiscoveryImportMutation = graphql`
  mutation contactDiscoveryOperationsImportMutation(
    $input: ImportViewerContactEntriesInput!
  ) {
    importViewerContactEntries(input: $input) {
      importedCount
      errors {
        field
        message
      }
    }
  }
`;
