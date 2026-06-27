export type LiveMediaSessionDescriptionType = 'answer' | 'offer';

export type LiveMediaSessionDescription<
  Type extends LiveMediaSessionDescriptionType = LiveMediaSessionDescriptionType,
> = {
  readonly sdp: string;
  readonly type: Type;
};

export type LiveMediaSessionDescriptionSource = Readonly<{
  sdp?: unknown;
  type?: unknown;
}>;

export type LiveMediaIceCandidateSource = Readonly<{
  candidate?: unknown;
  sdpMLineIndex?: unknown;
  sdpMid?: unknown;
  sdp_m_line_index?: unknown;
  sdp_mid?: unknown;
  toJSON?: () => unknown;
  usernameFragment?: unknown;
  username_fragment?: unknown;
}>;

export type LiveMediaIceCandidatePayload = {
  readonly candidate: string;
  readonly sdp_m_line_index?: number;
  readonly sdp_mid?: string;
  readonly username_fragment?: string;
};

export type LiveMediaIceServerCredentialType =
  | '%future added value'
  | 'OAUTH'
  | 'PASSWORD'
  | null;

export type LiveMediaIceServerSource = {
  readonly credential?: string | null;
  readonly credentialType?: string | null;
  readonly username?: string | null;
  readonly urls?: ReadonlyArray<string> | null;
};

export type LiveMediaIceServer = {
  readonly credential: string | null;
  readonly credentialType: LiveMediaIceServerCredentialType;
  readonly username: string | null;
  readonly urls: ReadonlyArray<string>;
};
