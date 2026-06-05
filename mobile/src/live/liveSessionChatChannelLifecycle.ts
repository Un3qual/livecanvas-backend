export type LiveSessionChatChannelLifecycleOptions = {
  readonly clearClientRef: () => void;
  readonly disconnectSocket: () => void;
  readonly failPendingSendForEndedSession: () => void;
  readonly leaveChannel: () => void;
  readonly markClosedForEndedSession: () => void;
};

export type LiveSessionChatChannelLifecycle = {
  readonly cleanup: () => void;
  readonly closeForEndedSession: () => void;
  readonly isActive: () => boolean;
  readonly runIfActive: (callback: () => void) => void;
};

export function createLiveSessionChatChannelLifecycle({
  clearClientRef,
  disconnectSocket,
  failPendingSendForEndedSession,
  leaveChannel,
  markClosedForEndedSession,
}: LiveSessionChatChannelLifecycleOptions): LiveSessionChatChannelLifecycle {
  let isActive = true;
  let didDisconnect = false;
  let didCloseEndedSession = false;

  function disconnect() {
    if (didDisconnect) {
      return;
    }

    didDisconnect = true;
    clearClientRef();
    leaveChannel();
    disconnectSocket();
  }

  return {
    cleanup: () => {
      isActive = false;
      disconnect();
    },
    closeForEndedSession: () => {
      isActive = false;

      if (!didCloseEndedSession) {
        didCloseEndedSession = true;
        failPendingSendForEndedSession();
        markClosedForEndedSession();
      }

      disconnect();
    },
    isActive: () => isActive,
    runIfActive: (callback) => {
      if (isActive) {
        callback();
      }
    },
  };
}
