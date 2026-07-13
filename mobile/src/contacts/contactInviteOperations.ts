import { graphql } from 'react-relay';

export type {
  contactInviteOperationsConsumeMutation as ContactInviteConsumeMutation,
} from '../__generated__/contactInviteOperationsConsumeMutation.graphql';

export const contactInviteConsumeMutation = graphql`
  mutation contactInviteOperationsConsumeMutation(
    $input: ConsumeContactInviteInput!
  ) {
    consumeContactInvite(input: $input) {
      consumed
      errors {
        field
        message
      }
    }
  }
`;
