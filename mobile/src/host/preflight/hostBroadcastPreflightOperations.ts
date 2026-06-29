import { graphql } from 'react-relay';

export type {
  hostBroadcastPreflightOperationsEndMutation as HostBroadcastPreflightScreenEndMutation,
} from '../../__generated__/hostBroadcastPreflightOperationsEndMutation.graphql';
export type {
  hostBroadcastPreflightOperationsGoLiveMutation as HostBroadcastPreflightScreenGoLiveMutation,
} from '../../__generated__/hostBroadcastPreflightOperationsGoLiveMutation.graphql';
export type {
  hostBroadcastPreflightOperationsPrepareMediaMutation as HostBroadcastPreflightScreenPrepareMediaMutation,
} from '../../__generated__/hostBroadcastPreflightOperationsPrepareMediaMutation.graphql';
export type {
  hostBroadcastPreflightOperationsStartMutation as HostBroadcastPreflightScreenStartMutation,
} from '../../__generated__/hostBroadcastPreflightOperationsStartMutation.graphql';

export const hostBroadcastPreflightScreenStartMutation = graphql`
  mutation hostBroadcastPreflightOperationsStartMutation(
    $input: StartLiveSessionInput!
  ) {
    startLiveSession(input: $input) {
      liveSession {
        id
        status
        channelTopic
      }
      errors {
        field
        message
      }
    }
  }
`;

export const hostBroadcastPreflightScreenPrepareMediaMutation = graphql`
  mutation hostBroadcastPreflightOperationsPrepareMediaMutation(
    $input: PrepareLiveMediaSessionInput!
  ) {
    prepareLiveMediaSession(input: $input) {
      liveSession {
        id
        status
        channelTopic
      }
      signalingTopic
      iceServers {
        urls
        username
        credential
        credentialType
      }
      errors {
        field
        message
      }
    }
  }
`;

export const hostBroadcastPreflightScreenGoLiveMutation = graphql`
  mutation hostBroadcastPreflightOperationsGoLiveMutation(
    $input: GoLiveSessionInput!
  ) {
    goLiveSession(input: $input) {
      liveSession {
        id
        status
        channelTopic
      }
      errors {
        field
        message
      }
    }
  }
`;

export const hostBroadcastPreflightScreenEndMutation = graphql`
  mutation hostBroadcastPreflightOperationsEndMutation(
    $input: EndLiveSessionInput!
  ) {
    endLiveSession(input: $input) {
      liveSession {
        id
        status
        channelTopic
      }
      errors {
        field
        message
      }
    }
  }
`;
