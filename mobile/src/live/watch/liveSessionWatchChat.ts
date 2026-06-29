import type { LiveSessionChatChannelMachineEvent } from '../chat/state/liveSessionChatChannelMachine';

export type LiveSessionPendingChatSend<Token = unknown> = {
  readonly sessionId: string;
  readonly token: Token;
};

export type RejectedLiveSessionChatSendResult<Token = unknown> = {
  readonly failureEvent:
    | Extract<LiveSessionChatChannelMachineEvent, { type: 'SEND_FAILED' }>
    | null;
  readonly nextPendingSend: LiveSessionPendingChatSend<Token> | null;
};

type RejectedLiveSessionChatSendInput<Token> = {
  readonly didUnmount: boolean;
  readonly error: unknown;
  readonly liveSessionId: string;
  readonly pendingSend: LiveSessionPendingChatSend<Token> | null;
  readonly sendToken: Token;
};

export function canUseLiveSessionChat({
  hasRetainedHostPublishingSession,
  isJoined,
}: {
  readonly hasRetainedHostPublishingSession: boolean;
  readonly isJoined: boolean;
}): boolean {
  return isJoined || hasRetainedHostPublishingSession;
}

export function resolveRejectedLiveSessionChatSend<Token>({
  didUnmount,
  error,
  liveSessionId,
  pendingSend,
  sendToken,
}: RejectedLiveSessionChatSendInput<Token>): RejectedLiveSessionChatSendResult<Token> {
  const isActiveSend =
    pendingSend?.sessionId === liveSessionId && pendingSend.token === sendToken;

  if (!isActiveSend) {
    return {
      failureEvent: null,
      nextPendingSend: pendingSend,
    };
  }

  return {
    failureEvent: didUnmount
      ? null
      : {
          error:
            error instanceof Error
              ? error.message
              : 'Chat message could not be sent.',
          sessionId: liveSessionId,
          type: 'SEND_FAILED',
        },
    nextPendingSend: null,
  };
}
