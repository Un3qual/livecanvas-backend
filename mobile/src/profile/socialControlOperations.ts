import { graphql } from 'react-relay';

export const socialControlMuteUserMutation = graphql`
  mutation socialControlOperationsMuteUserMutation($input: MuteUserInput!) {
    muteUser(input: $input) {
      errors {
        field
        message
      }
    }
  }
`;

export const socialControlUnmuteUserMutation = graphql`
  mutation socialControlOperationsUnmuteUserMutation($input: UnmuteUserInput!) {
    unmuteUser(input: $input) {
      errors {
        field
        message
      }
    }
  }
`;

export const socialControlBlockUserMutation = graphql`
  mutation socialControlOperationsBlockUserMutation($input: BlockUserInput!) {
    blockUser(input: $input) {
      errors {
        field
        message
      }
    }
  }
`;
