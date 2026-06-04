# Mobile Live Media Signaling Contract

## Overview

This contract freezes the mobile-facing setup and Phoenix Channel message shapes for native live-session media negotiation. It does not define a Membrane pipeline, persisted TURN credentials, recording storage, or viewer playback state.

Durable authorization and session lookup stay in GraphQL. Ephemeral WebRTC negotiation messages stay on the authorized live-session Phoenix Channel.

## `prepareLiveMediaSession`

Mobile hosts prepare media negotiation through a Relay-style GraphQL mutation:

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

Stable failure behavior:

- Missing viewer scope returns `errors: [{field: null, message: "unauthenticated"}]`.
- Invalid or wrong-type `liveSessionId` returns `errors: [{field: "liveSessionId", message: "is invalid"}]`.
- Foreign, hidden, non-host, or terminal sessions return payload errors instead of top-level crashes.

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
- This batch returns deterministic STUN setup data from `LC.Live.MediaSignaling`; later TURN providers may mint short-lived credentials at request time.
- TURN secrets must not be persisted as live-session records or client-reusable durable secrets.

## Signaling Topic

`signalingTopic` is the same opaque live-session topic family as `LiveSession.channelTopic`.

- The backend must derive it with `LCTransport.LiveSessionTopics.live_session_topic/1`.
- Mobile clients must pass the returned topic to Phoenix Channels exactly as received.
- Clients must not construct, parse, persist, or infer topic segments from Relay IDs.
- Channel joins re-apply the same viewer authorization and session-state checks documented in `docs/contracts/mobile-live-session-realtime.md`.

## Phoenix Channel Events

Media signaling uses the authorized live-session channel and these event names:

- `media:offer`
- `media:answer`
- `media:ice_candidate`

These messages are ephemeral negotiation messages. They are not retained in timeline history and are not replayed after reconnect.

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

## Backend Boundary

`LC.Live.MediaSignaling` is the typed backend boundary for this contract slice:

- `prepare_live_media_session/0` returns deterministic ICE setup data and event names.
- `ice_servers/0` returns the current deterministic ICE server list.
- `media_events/0` returns the Phoenix Channel event names.
- `validate_offer_payload/1`, `validate_answer_payload/1`, `validate_ice_candidate_payload/1`, and `validate_event_payload/2` validate payload shape and return structured field errors.

The boundary is intentionally pure. It does not start Membrane, allocate peer connections, write database rows, persist TURN secrets, or broadcast channel messages.

Any change to the mutation name, ICE server fields, signaling topic semantics, event names, payload keys, or validation requirements should be treated as a mobile API change and planned explicitly before landing downstream client work.
