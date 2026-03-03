# LiveCanvas Backend Architecture

## Status

This document defines the approved backend architecture for the LiveCanvas Elixir
application as of 2026-03-01.

It describes the v1 backend boundaries and the intended extension points for
later phases. It is intentionally scoped to the backend only.

## V1 Scope

V1 focuses on:

- account creation and authentication
- follower graph with public/private accounts
- posts, stories, and media metadata
- live sessions and live chat
- GraphQL as the primary client API
- REST for webhooks and external callbacks
- WebSockets for chat, presence, and live state

Explicitly deferred from v1:

- billing and monetization
- geo/location features
- profile customization and layout editing
- two-factor authentication

## Core Principles

- Modular monolith: one Phoenix application with strict internal boundaries.
- One deployable per pod: each Kubernetes pod runs the same release.
- PostgreSQL is the only persistent datastore.
- Redis is not part of the system now or later.
- Use OTP, Phoenix PubSub, and Phoenix Presence for ephemeral coordination.
- Persist only durable facts; keep transient runtime state in supervised
  processes.
- Prefer architecture that can evolve without rewriting core domain boundaries.

## Cross-Cutting Maintainability Rules

### Boundary Rules

- Treat each top-level context module as an interface boundary.
- Enforce internal module boundaries with the `boundary` library instead of
  relying on convention alone.
- Use top-level boundary declarations for `LCApp`, `LC`, `LCWeb`, `LCGQL`, and
  `LCSchemas`.
- Use nested core boundaries such as `LC.Accounts` and `LC.Infra` instead of
  promoting every subsystem to top-level.
- Keep Ecto schemas under `LCSchemas` so schema-heavy code does not
  overwhelm the core context folders.
- Keep `LCSchemas` modules schema-only: no changeset building, no repo
  operations, and no workflow logic.
- Export only stable entrypoints from each boundary. Temporary exports needed by
  the Phoenix auth scaffold or compiled test support should be treated as
  migration allowances, not the long-term target shape.
- Normalize transport-specific input at the boundary only.
- Keep internal business logic independent from Absinthe, Plug, Phoenix socket
  payloads, and controller params.

### Function Anatomy

- Public write paths should split into:
  - pure decision logic
  - effectful coordination
- Pure logic returns domain decisions or normalized change instructions.
- Coordinators perform `Repo`, PubSub, Presence, and external side effects.

### Process Topology

- Use OTP processes only for explicit runtime entities or asynchronous ownership
  boundaries.
- Prefer plain modules for synchronous domain logic.
- `Live` owns session processes; other contexts stay process-light unless
  runtime behavior proves otherwise.

### Testing Strategy

- Prefer pure input/output tests for internal business rules.
- Concentrate side-effect assertions in boundary-level integration tests.
- Run `mix compile` immediately after adding or changing a boundary declaration
  so violations surface before larger changes stack up.
- Avoid introducing abstractions whose only purpose is easy mocking.

## System Architecture

LiveCanvas runs as a single Phoenix/Absinthe application deployed in Kubernetes.
Each pod runs the same Elixir release and can serve:

- GraphQL requests
- REST webhook endpoints
- Phoenix Channels / WebSockets
- background jobs
- Membrane-based WebRTC media orchestration

### Realtime And Media

- Phoenix Channels is the primary realtime transport for chat and session events.
- Phoenix PubSub and Phoenix Presence coordinate distributed realtime state.
- Live streaming uses Elixir with Membrane/WebRTC inside the main application
  runtime for v1.
- If latency or stream fanout later requires it, dedicated SFU/media pods can be
  added in the cluster without changing the core domain model.

### Stateful Dependencies

- PostgreSQL is the system of record for all durable data.
- Media binaries should live in object storage; Postgres stores metadata and
  object references only.

## Domain Boundaries

The backend is organized as a modular monolith with these v1 contexts:

### Accounts

Owns:

- users and account state
- authentication and session lifecycle
- linked identities and credentials
- normalized email and phone records
- verification flows
- contact import records
- account privacy and moderation flags

This context does not own follow logic, feed logic, or live session behavior.

### Social

Owns:

- follow relationships
- follow requests and approval for private accounts
- blocks
- mutes
- relationship-based visibility checks

This is the policy layer for who can see or interact with whom.

### Content

Owns:

- posts
- story-like content
- media metadata
- live replay and recording references

This context stores durable user-visible content, not transient session state.

### Live

Owns:

- live session lifecycle
- countdown and start intent
- host/viewer role state
- join and leave events
- live session status transitions
- recording linkage when a session ends

This context manages session state and media-facing orchestration boundaries.

### Chat

Owns:

- live chat messages
- chat moderation
- chat-oriented system events
- channel-level interaction rules

Chat stays separate from `Live` because message handling, moderation, retention,
and throughput concerns differ from live session lifecycle management.

### Feed

Owns read-side orchestration for:

- home timeline retrieval
- stories and replay surfaces
- "who is live" surfaces
- ranking and filtering based on visibility rules

`Feed` composes data from other contexts and should remain read-oriented rather
than owning primary records.

## API And Realtime Model

### Client Contracts

- GraphQL is the primary API for mobile and web clients.
- Use GraphQL queries and mutations for durable reads and writes.
- Use Phoenix Channels / WebSockets for:
  - live chat
  - presence
  - countdown broadcasts
  - live session state
  - join/leave notifications
- Use REST only where non-GraphQL integration is a better fit, such as webhook
  receivers.

### Live Session Flow

1. A host initiates "go live".
2. The backend creates a `live_sessions` record in a transitional state such as
   `starting`.
3. A supervised session process is started or located for that live session.
4. Countdown and session events are broadcast over Channels.
5. The session transitions to `live` when media negotiation succeeds.
6. Eligible followers can join and receive session updates.
7. When the session ends, durable session state is finalized and replay metadata
   becomes available to the feed.

### Durable Vs Ephemeral State

Persist in Postgres:

- users
- identities
- follows and blocks
- posts and media metadata
- live session records
- retained chat history
- replay/recording metadata

Keep ephemeral in OTP / Presence / PubSub:

- active participant presence
- countdown state
- transient media state
- typing or activity indicators

## Data Model And Storage Strategy

### Primary Storage Rules

- PostgreSQL is the only persistent datastore.
- `users` must not contain denormalized primary email or primary phone columns.
- All email and phone identity is modeled through normalized shared tables and
  join tables.
- Store hashed or encrypted secrets only; never store raw token secrets.

### Accounts Tables

#### `users`

The canonical account row. It should store account-level state such as privacy
mode, moderation flags, and timestamps. It should not directly own primary email
or phone columns.

#### `user_identities`

Belongs to `user` and represents login-capable identities and credentials. This
table supports:

- email/password
- email magic link or one-time code
- phone/password
- phone magic link or one-time code
- Google OAuth
- Apple OAuth
- passkeys

Expected fields include:

- provider
- provider subject / uid
- encrypted provider tokens where applicable
- provider metadata (`jsonb`)
- last-used, revoked, or similar lifecycle timestamps

For passkeys, store only the credential metadata required by the WebAuthn model.

#### `email_addresses`

Stores every normalized email address used in the app. The normalized email
value should be unique.

#### `phone_numbers`

Stores every normalized phone number used in the app, typically in E.164 form.
The normalized number should be unique.

#### `user_email_addresses`

Joins users to normalized email addresses. This table carries ownership and
verification state, including `verified_at`.

#### `user_phone_numbers`

Joins users to normalized phone numbers. This table carries ownership and
verification state, including `verified_at`.

#### `user_contact_entries`

Stores uploaded address-book entries owned by a user. Each entry should include:

- contact name
- birthday
- client-side contact identifier

The durable import model exists in v1; invitation and matching workflows can be
expanded later.

#### `user_contact_entry_email_addresses`

Joins `user_contact_entries` to normalized `email_addresses`.

#### `user_contact_entry_phone_numbers`

Joins `user_contact_entries` to normalized `phone_numbers`.

#### `user_tokens`

The existing token model should be revised:

- primary key is Postgres-generated UUIDv7
- belongs to `user`
- includes a binary `secret_hash`
- stores token context / purpose

This table should support:

- sessions
- refresh tokens
- password reset tokens
- magic login links
- email verification
- phone verification
- one-time code flows

Only the token hash is persisted. Raw secrets are returned to the client once
and must not be stored in recoverable form.

### Other V1 Tables

#### `follows`

Stores follower-to-account relationships and request/accept state for private
accounts.

#### `blocks`

Stores hard access restrictions that override follow-based visibility.

#### `posts`

Stores durable user-created content. Story-like behavior can be represented
either as a post kind with expiration metadata or, if the lifecycle diverges
materially, as a separate table later.

#### `media_assets`

Stores uploaded file metadata such as:

- owner
- MIME type
- dimensions
- duration
- processing state
- object storage location

#### `live_sessions`

Stores live session facts:

- host
- status
- visibility snapshot
- start and end timestamps
- replay / recording linkage

#### `live_participants`

Optional but recommended for durable participation facts, analytics, and
post-session reporting.

#### `chat_messages`

Stores retained chat history when the product needs replay, moderation history,
or auditability.

## Authentication, Authorization, And Security

### Authentication

The authentication layer supports multiple login methods attached to the same
user account:

- email + password
- email + magic link / one-time code
- phone + password
- phone + magic link / one-time code
- Google OAuth
- Apple OAuth
- passkeys

Authentication resolves the presented credential to a normalized identity, then
maps that identity to a single `user`.

### Account Linking

- One user can have multiple linked identities.
- Linking rules must be explicit and policy-driven.
- The system must not silently attach a new credential to the wrong user.
- The model must leave room for step-up auth and 2FA later.

### Authorization

Authorization is layered:

1. authentication establishes `current_user`
2. `Social` enforces relationship-based access
3. each domain enforces resource-specific rules

Private/public visibility must be enforced consistently across:

- feed reads
- live join access
- chat participation
- replay visibility

`blocks` override any follow-based access.

### Realtime Security

- Channel joins must be authenticated and authorized per topic.
- Live and chat topics must validate:
  - viewer eligibility
  - participation role
  - session access
- Presence payloads should expose only the minimum client-visible state.

### Secret Handling

- Passwords are stored as strong password hashes.
- `user_tokens.secret_hash` stores only hashed token secrets.
- Retained OAuth provider tokens should be encrypted at rest.
- Passkey data must not weaken the WebAuthn trust model.

### Abuse Controls

- Implement rate limiting at the application and endpoint layers.
- Keep auditable records for sensitive auth events such as login success/failure,
  credential link/unlink, and token revocation.
- Verification flows should be idempotent and resistant to account enumeration
  where practical.

## Testing And Operations

### Testing Strategy

Test in layers aligned to the domain boundaries:

- context tests for each core context
- GraphQL API tests
- Channel / realtime tests
- integration tests for critical end-to-end user flows
- isolated tests for Membrane/WebRTC boundary modules

The goal is to verify business rules and contracts, not just controller or
resolver plumbing.

### Operations

- Run a single Phoenix/Elixir release in Kubernetes.
- Every pod runs the same app image and can serve GraphQL, REST, Channels,
  jobs, and media orchestration.
- Use explicit supervision trees for long-lived live session and media
  processes.
- Use liveness and readiness checks appropriate for BEAM health and database
  readiness.

### Observability

Instrument critical flows with Telemetry:

- auth attempts and failures
- live session start/join/end
- channel join failures
- message throughput
- media session errors
- database latency

Logs should make it possible to correlate a request, user, session, and channel
topic without leaking secrets.

### Failure Handling

- Clients should reconnect and re-fetch authoritative state after disconnects.
- Durable state comes from Postgres.
- Ephemeral state should be reconstructed where practical.
- If recovery is not feasible, sessions should degrade cleanly and be marked
  interrupted or ended explicitly.
- Background work should be retryable and idempotent where possible.

## Phased Evolution

### V1

- accounts and linked identities
- public/private follower graph
- posts, stories, and media metadata
- live sessions
- live chat
- GraphQL + Channels + minimal REST

### Later

- contact matching and invite workflows
- richer moderation
- stronger live session recovery and scaling
- profile customization
- billing and monetization
- geo/location features
- optional dedicated SFU/media pods in-cluster if needed

Future phases should add new contexts or runtime specialization without forcing
a rewrite of the v1 modular-monolith boundaries.
