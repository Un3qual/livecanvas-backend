import { graphql } from 'react-relay';

export type {
  liveSessionChatControlOperationsEditMutation as LiveSessionChatControlEditMutation,
} from '../../__generated__/liveSessionChatControlOperationsEditMutation.graphql';
export type {
  liveSessionChatControlOperationsRemoveMutation as LiveSessionChatControlRemoveMutation,
} from '../../__generated__/liveSessionChatControlOperationsRemoveMutation.graphql';

/** Server-authoritative mutations for active-session message controls. */
export const liveSessionChatEditMutation = graphql`
  mutation liveSessionChatControlOperationsEditMutation(
    $input: EditLiveChatMessageInput!
  ) {
    editLiveChatMessage(input: $input) {
      chatMessageEvent {
        id
        body
        edited
        editCount
        editedAt
        actor {
          id
        }
      }
      errors {
        field
        message
      }
    }
  }
`;

export const liveSessionChatRemoveMutation = graphql`
  mutation liveSessionChatControlOperationsRemoveMutation(
    $input: RemoveLiveChatMessageEventInput!
  ) {
    removeLiveChatMessageEvent(input: $input) {
      removedTimelineEventId
      errors {
        field
        message
      }
    }
  }
`;
