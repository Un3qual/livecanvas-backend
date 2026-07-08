import { graphql } from 'react-relay';

export const passwordRecoveryRequestMutation = graphql`
  mutation passwordRecoveryOperationsRequestMutation(
    $input: RequestPasswordResetInput!
  ) {
    requestPasswordReset(input: $input) {
      errors {
        field
        message
      }
    }
  }
`;

export const passwordRecoveryResetMutation = graphql`
  mutation passwordRecoveryOperationsResetMutation($input: ResetPasswordInput!) {
    resetPassword(input: $input) {
      reset
      errors {
        field
        message
      }
    }
  }
`;
