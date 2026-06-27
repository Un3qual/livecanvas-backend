import { createActor, type ActorRefFrom } from 'xstate';

import {
  INITIAL_LIVE_SESSION_CHAT_CHANNEL_STATE,
  liveSessionChatChannelMachine,
  selectLiveSessionChatChannelState,
  type LiveSessionChatChannelMachineEvent,
  type LiveSessionChatChannelViewState,
} from './liveSessionChatChannelMachine';

type LiveSessionChatChannelActor = ActorRefFrom<
  typeof liveSessionChatChannelMachine
>;

export type LiveSessionChatChannelActorLifecycle = {
  readonly getState: () => LiveSessionChatChannelViewState;
  readonly send: (
    event: LiveSessionChatChannelMachineEvent,
  ) => LiveSessionChatChannelViewState;
  readonly start: () => void;
  readonly stop: () => void;
};

export type LiveSessionChatChannelActorLifecycleOptions = {
  readonly onStateChanged: (state: LiveSessionChatChannelViewState) => void;
};

export function createLiveSessionChatChannelActorLifecycle({
  onStateChanged,
}: LiveSessionChatChannelActorLifecycleOptions): LiveSessionChatChannelActorLifecycle {
  let actor: LiveSessionChatChannelActor | null = null;
  let currentState = INITIAL_LIVE_SESSION_CHAT_CHANNEL_STATE;

  function start() {
    if (actor) {
      return;
    }

    actor = createActor(liveSessionChatChannelMachine).start();
    currentState = selectLiveSessionChatChannelState(actor.getSnapshot());
  }

  function stop() {
    actor?.stop();
    actor = null;
    currentState = INITIAL_LIVE_SESSION_CHAT_CHANNEL_STATE;
  }

  function send(
    event: LiveSessionChatChannelMachineEvent,
  ): LiveSessionChatChannelViewState {
    if (!actor) {
      return currentState;
    }

    actor.send(event);

    if (!actor) {
      return currentState;
    }

    currentState = selectLiveSessionChatChannelState(actor.getSnapshot());
    onStateChanged(currentState);
    return currentState;
  }

  function getState() {
    return currentState;
  }

  return {
    getState,
    send,
    start,
    stop,
  };
}
