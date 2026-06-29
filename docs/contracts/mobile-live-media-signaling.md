# Mobile Live Media Signaling Contract

## Overview

This contract freezes the mobile-facing setup and Phoenix Channel message shapes for native live-session media negotiation. It does not define a Membrane pipeline, persisted TURN credentials, recording storage, or viewer playback state.

Durable authorization and session lookup stay in GraphQL. Ephemeral WebRTC negotiation messages stay on the authorized media-signaling Phoenix Channel.

Hosts and active joined viewers should prepare media setup through GraphQL, join
the returned signaling topic, and exchange WebRTC negotiation messages. Hosts
should only retry `goLiveSession` after the negotiation path has made media
readiness observable.

## `prepareLiveMediaSession`

Mobile clients prepare media negotiation through a Relay-style GraphQL mutation:

```graphql
mutation PrepareLiveMediaSession($liveSessionId: ID!) {
  prepareLiveMediaSession(input: {liveSessionId: $liveSessionId}) {
    liveSession { id status channelTopic }
    signalingTopic
    iceServers {
      urls
      username
      credential
      credentialType
    }
    errors { field message }
  }
}
```

Stable successful payload fields:

- `liveSession`: the authorized `LiveSession` node being prepared
- `signalingTopic`: the Phoenix Channel topic used for media signaling
- `iceServers`: the ICE server list for WebRTC peer connection setup
- `errors`: empty on success

Authorization rules:

- The host may prepare setup for their own non-ended session.
- A non-host viewer may prepare setup only after they have joined the session
  and still have an active live participant row.
- The viewer path rechecks current join authorization before returning setup.
- The mutation does not create or restore live participation; viewers that have
  not joined must call `joinLiveSession` or join the live-session channel first.

Stable failure behavior:

- Missing viewer scope returns `errors: [{field: null, message: "unauthenticated"}]`.
- Invalid or wrong-type `liveSessionId` returns `errors: [{field: "liveSessionId", message: "is invalid"}]`.
- Foreign, hidden, non-joined, or terminal sessions return payload errors instead of top-level crashes.

## `goLiveSession` Media Readiness

`goLiveSession` remains the host-only transition from `STARTING` to `LIVE`, but
the backend now gates it on media negotiation readiness. Until the runtime marks
the session media-ready, the mutation returns:

```json
{
  "liveSession": null,
  "errors": [{ "field": null, "message": "media_not_ready" }]
}
```

Mobile should treat `media_not_ready` as a retryable negotiation state, not as a
terminal session failure. Complete the prepare/channel/WebRTC negotiation flow
and retry `goLiveSession`.

The current readiness signal is a durable live-media readiness row. Mobile
clients should still be prepared to renegotiate or retry setup when the backend
reports `media_not_ready`.

## ICE Server Shape

Each `iceServers` entry maps to a WebRTC `RTCIceServer`:

```json
{
  "urls": ["stun:stun.l.google.com:19302"],
  "username": null,
  "credential": null,
  "credentialType": null
}
```

Field rules:

- `urls` is required and contains one or more `stun:`, `turn:`, or `turns:` URLs.
- `username`, `credential`, and `credentialType` are nullable and present only when a TURN server requires credentials.
- `credentialType` is `PASSWORD` for normal TURN username/password credentials and `OAUTH` for OAuth-style TURN credentials.
- The current mobile React Native WebRTC integration accepts only STUN entries
  and normal TURN username/password credentials. Mobile must omit unsupported
  `OAUTH` or future credential schemes rather than passing them to the native
  peer-connection config as password credentials.
- `LC.Live.MediaSignaling` serves the list from a typed, configurable ICE/TURN provider. The default development configuration still returns deterministic STUN setup data, while deployed providers may mint short-lived TURN credentials at request time.
- TURN secrets must not be persisted as live-session records or client-reusable durable secrets.

## Signaling Topic

`signalingTopic` is a dedicated opaque media-signaling topic, separate from
`LiveSession.channelTopic`.

- The backend must derive it with `LCTransport.LiveSessionTopics.media_signaling_topic/1`.
- Mobile clients must pass the returned topic to Phoenix Channels exactly as received.
- Clients must not construct, parse, persist, or infer topic segments from Relay IDs.
- Channel joins re-apply the same viewer authorization and session-state checks documented in `docs/contracts/mobile-live-session-realtime.md`.
- Joining the media-signaling topic does not create a live participant or
  broadcast live-session state; clients that need session-state events should
  also join `LiveSession.channelTopic`.

## Phoenix Channel Events

Media signaling uses the authorized media-signaling channel and these event names:

- `media:offer`
- `media:answer`
- `media:ice_candidate`
- `media:viewer_ready`

These messages are ephemeral negotiation messages. They are not retained in
timeline history or replayed by the backend. Viewers that join media signaling
after a host offer must push `media:viewer_ready` so the active host can
best-effort re-send its current offer and any locally gathered host ICE
candidates still held by the in-memory host runtime.

### `media:offer`

Client push payload:

```json
{
  "type": "offer",
  "sdp": "v=0\r\n..."
}
```

Server broadcast payload:

```json
{
  "type": "offer",
  "sdp": "v=0\r\n...",
  "sender_role": "host"
}
```

Validation rules:

- `type` must be `offer`.
- `sdp` must be a non-empty string.
- Clients must not rely on any client-provided `sender_role`; the server derives sender metadata from the joined socket.

### `media:answer`

Client push payload:

```json
{
  "type": "answer",
  "sdp": "v=0\r\n..."
}
```

Server broadcast payload:

```json
{
  "type": "answer",
  "sdp": "v=0\r\n...",
  "sender_role": "viewer"
}
```

Validation rules:

- `type` must be `answer`.
- `sdp` must be a non-empty string.
- The server derives `sender_role`.

### `media:ice_candidate`

Client push payload:

```json
{
  "candidate": "candidate:842163049 1 udp 1677729535 192.0.2.10 54400 typ srflx",
  "sdp_mid": "0",
  "sdp_m_line_index": 0,
  "username_fragment": "ufrag"
}
```

Server broadcast payload:

```json
{
  "candidate": "candidate:842163049 1 udp 1677729535 192.0.2.10 54400 typ srflx",
  "sdp_mid": "0",
  "sdp_m_line_index": 0,
  "username_fragment": "ufrag",
  "sender_role": "host"
}
```

Validation rules:

- `candidate` is required and must be a non-empty string.
- `sdp_mid` is optional and must be a string when present.
- `sdp_m_line_index` is optional and must be a non-negative integer when present.
- `username_fragment` is optional and must be a string when present.
- The server derives `sender_role`.

### `media:viewer_ready`

Viewer push payload:

```json
{}
```

Server broadcast payload:

```json
{
  "sender_role": "viewer"
}
```

Validation rules:

- Payload must be an object.
- Only active live-session viewers may push this event.
- The server targets this event to the host and derives `sender_role`.
- Hosts use this event as an offer and host-ICE replay trigger within the
  current in-memory runtime. In the one-host/one-viewer beta path, a ready
  signal after negotiation is already marked ready resets the single retained
  host peer connection and publishes a fresh offer. The current payload shape
  does not carry per-viewer media identity for multi-viewer peer-connection
  routing.

## Backend Boundary

`LC.Live.MediaSignaling` is the typed backend boundary for this contract slice:

- `prepare_live_media_session/0` returns `{:ok, setup}` with configured ICE
  setup data and event names, or a tagged error when provider setup fails.
- `ice_servers/0` returns `{:ok, ice_servers}` for the current
  provider-backed ICE server list, or a tagged provider/config error.
- `media_events/0` returns the Phoenix Channel event names.
- `validate_offer_payload/1`, `validate_answer_payload/1`,
  `validate_ice_candidate_payload/1`, and `validate_event_payload/2` validate
  payload shape and return structured field errors.

The boundary is intentionally pure. It does not start Membrane, allocate peer connections, write database rows, persist TURN secrets, or broadcast channel messages.

Any change to the mutation name, ICE server fields, signaling topic semantics, event names, payload keys, or validation requirements should be treated as a mobile API change and planned explicitly before landing downstream client work.
