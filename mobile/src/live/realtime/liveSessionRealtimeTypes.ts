export type LiveSessionTimelineEventActor = {
  readonly id: string;
};

export type LiveSessionTimelineEventPayload = {
  readonly __typename: string;
  readonly id: string;
  readonly eventType: string;
  readonly body: string | null;
  readonly actor: LiveSessionTimelineEventActor | null;
  readonly occurredAt: string;
  readonly edited: boolean | null;
  readonly editCount: number | null;
  readonly editedAt: string | null;
};

export type LiveSessionRealtimeMediaSenderRole = 'host' | 'viewer';

export type LiveSessionRealtimeMediaDescription = {
  readonly sdp: string;
  readonly type: 'offer' | 'answer';
};

export type LiveSessionRealtimeIceCandidate = {
  readonly candidate: string;
  readonly sdpMLineIndex?: number;
  readonly sdpMid?: string;
  readonly usernameFragment?: string;
};

export type LiveSessionRealtimeSessionStateEvent = {
  readonly kind: 'session_state';
  readonly status: 'STARTING' | 'LIVE' | 'ENDED';
  readonly visibility: 'PUBLIC' | 'FOLLOWERS';
  readonly viewerCount: number;
};

export type LiveSessionRealtimeTimelineEvent = {
  readonly kind: 'timeline_event';
  readonly event: LiveSessionTimelineEventPayload;
};

export type LiveSessionRealtimeTimelineEventUpdated = {
  readonly kind: 'timeline_event_updated';
  readonly event: LiveSessionTimelineEventPayload;
};

export type LiveSessionRealtimeTimelineEventRemoved = {
  readonly kind: 'timeline_event_removed';
  readonly removedTimelineEventId: string;
};

export type LiveSessionRealtimeMediaOfferEvent = {
  readonly description: LiveSessionRealtimeMediaDescription & {
    readonly type: 'offer';
  };
  readonly kind: 'media_offer';
  readonly senderRole: LiveSessionRealtimeMediaSenderRole;
};

export type LiveSessionRealtimeMediaAnswerEvent = {
  readonly description: LiveSessionRealtimeMediaDescription & {
    readonly type: 'answer';
  };
  readonly kind: 'media_answer';
  readonly senderRole: LiveSessionRealtimeMediaSenderRole;
};

export type LiveSessionRealtimeMediaIceCandidateEvent = {
  readonly candidate: LiveSessionRealtimeIceCandidate;
  readonly kind: 'media_ice_candidate';
  readonly senderRole: LiveSessionRealtimeMediaSenderRole;
};

export type LiveSessionRealtimeMediaViewerReadyEvent = {
  readonly kind: 'media_viewer_ready';
  readonly senderRole: LiveSessionRealtimeMediaSenderRole;
};

export type LiveSessionHostMediaOfferEvent =
  LiveSessionRealtimeMediaOfferEvent & {
    readonly senderRole: 'host';
  };

export type LiveSessionViewerMediaAnswerEvent =
  LiveSessionRealtimeMediaAnswerEvent & {
    readonly senderRole: 'viewer';
  };

export type LiveSessionHostMediaIceCandidateEvent =
  LiveSessionRealtimeMediaIceCandidateEvent & {
    readonly senderRole: 'host';
  };

export type LiveSessionViewerMediaIceCandidateEvent =
  LiveSessionRealtimeMediaIceCandidateEvent & {
    readonly senderRole: 'viewer';
  };

export type LiveSessionViewerMediaReadyEvent =
  LiveSessionRealtimeMediaViewerReadyEvent & {
    readonly senderRole: 'viewer';
  };

export type LiveSessionRealtimeEvent =
  | LiveSessionRealtimeSessionStateEvent
  | LiveSessionRealtimeTimelineEvent
  | LiveSessionRealtimeTimelineEventUpdated
  | LiveSessionRealtimeTimelineEventRemoved
  | LiveSessionRealtimeMediaOfferEvent
  | LiveSessionRealtimeMediaAnswerEvent
  | LiveSessionRealtimeMediaIceCandidateEvent
  | LiveSessionRealtimeMediaViewerReadyEvent;
