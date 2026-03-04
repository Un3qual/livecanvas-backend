# LiveCanvas Backend Release Readiness Roadmap (2026-03-03)

## Snapshot

- Scope audited: `ARCHITECTURE.md`, `docs/architecture/conventions.md`, all files in `docs/plans/**`, core `lib/**`, migrations, and tests.
- Verification run on this snapshot:
  - `mix compile` -> PASS
  - `mix test` -> PASS (`345 tests, 0 failures`)
  - `mix typecheck` -> PASS
  - `mix precommit` -> PASS
- Plan tracking state: release-track plans are complete through release-engineering deployment gates, with media upload callback-driven async processing and deployment/rollback runbooks now in place (`docs/plans/2026-03-03-media-storage-and-processing.md`, `docs/plans/release/2026-03-03-webhooks-and-async-jobs.md`, `docs/plans/release/2026-03-03-release-engineering-and-deployment-gates.md`).

## What Has Been Delivered

### Architecture And Conventions Baseline

- Modular-monolith boundaries are in place (`LC`, `LCWeb`, `LCGQL`, `LCSchemas`, nested boundaries).
- Core conventions are implemented and documented:
  - SHA3 token hashing
  - `:utc_datetime_usec` timestamps
  - `bigint + entropy_id (uuidv7)` for relational tables
  - UUIDv7 exception path for `users_tokens`
  - Relay-first GraphQL shape for current surface
  - typespec + Dialyzer rollout (`mix typecheck` in workflow)

### Domain Slices Implemented

- Accounts:
  - normalized email/phone identity model
  - token issuance/validation + contact matching/import + invite token context
  - suspension moderation flag with cross-context enforcement
- Social:
  - follows, follow acceptance, blocks, mutes, relationship policy
- Content:
  - post + media metadata persistence surface
  - signed upload intent issuance + Relay media node/query lookup
  - viewer-scoped upload finalize lifecycle with processing seam (`pending_upload -> uploaded -> processed/failed`)
- Live:
  - live session lifecycle, participant persistence, runtime session process
  - participant leave reconciliation and restart rehydration
- Chat:
  - live-session chat authorization + persisted messages + channel broadcast
- Feed:
  - home feed and live-now read models with social/moderation filtering

### GraphQL + Realtime

- Relay node/global ID + connection pagination is in place for current nodes.
- GraphQL accounts/social/content/feed slices are implemented.
- WebSocket auth exists for channels via session token.

## Where We Are Now

The backend is in a strong "foundation complete / internal alpha" state, not yet in a "public release ready" state.

Main reason: the current API surface proves domain behavior, but live-runtime scaling hardening and production operations layers are not complete yet.

Auth/security baseline now includes viewer-scoped GraphQL writes, bearer token GraphQL auth precedence, GraphiQL environment gating, abuse-rate limiting, and persisted auth audit events for login outcomes, refresh-token revocation/rotation outcomes, and credential change outcomes.

Observability baseline now includes Telemetry instrumentation for live session lifecycle outcomes, live channel join/chat outcomes, and auth lifecycle parity events (`[:live_canvas, :accounts, :auth, <event_type>]`) with a documented launch-ops checklist in `docs/plans/release/2026-03-03-observability-and-launch-ops.md`.

## Explicitly Deferred (Still Out Of Scope For V1)

Per architecture decisions, these remain intentionally deferred and should not block a v1 social/live release unless product scope changes:

- billing/monetization
- geo/location features
- advanced profile customization/layout editing
- 2FA (beyond current preparatory data model seams)

## Detailed Plans Already Written

### Architecture/Design Decision Records

- `docs/plans/2026-03-01-backend-architecture-design.md`
- `docs/plans/conventions/2026-03-02-conventions-alignment-design.md`
- `docs/plans/2026-03-01-sasa-juric-alignment.md`

### Implemented Foundations And Domain Slices

- `docs/plans/2026-03-01-v1-backend-foundations.md`
- `docs/plans/2026-03-02-v1-task-2-remaining-accounts-apis.md`
- `docs/plans/2026-03-02-v1-task-3-graphql-accounts-apis.md`
- `docs/plans/2026-03-02-v1-task-4-social-graph.md`
- `docs/plans/2026-03-03-social-mutes-and-graph-controls.md`
- `docs/plans/2026-03-03-feed-mute-visibility-alignment.md`
- `docs/plans/2026-03-03-chat-mute-join-authorization.md`
- `docs/plans/2026-03-03-live-session-participant-leave-reconciliation.md`
- `docs/plans/2026-03-03-live-session-runtime-recovery.md`
- `docs/plans/2026-03-03-cross-context-suspension-enforcement.md`
- `docs/plans/2026-03-03-accounts-contact-matching-and-invites.md`
- `docs/plans/2026-03-03-accounts-contact-graphql-write-slice.md`
- plus supporting accounts slices from 2026-03-02.

### Convention Migration Plans

- `docs/plans/conventions/2026-03-02-id-and-entropy-id-migration.md`
- `docs/plans/conventions/2026-03-02-lc-module-rename.md`
- `docs/plans/conventions/2026-03-02-phone-otp-fake-sms-service.md`
- `docs/plans/conventions/2026-03-02-relay-first-graphql-migration.md`
- `docs/plans/conventions/2026-03-02-typespec-and-dialyzer-rollout.md`
- `docs/plans/conventions/2026-03-03-context-map-typing-rollout.md`
- `docs/plans/conventions/2026-03-03-relay-mutation-payload-cleanup.md`
- `docs/plans/conventions/2026-03-03-social-relay-global-id-alignment.md`

### Release Track Plans

- `docs/plans/2026-03-03-release-authn-authz-hardening.md`
- `docs/plans/release/2026-03-03-auth-audit-events.md`
- `docs/plans/release/2026-03-03-auth-audit-expansion.md`
- `docs/plans/release/2026-03-03-observability-and-launch-ops.md`
- `docs/plans/release/2026-03-03-live-runtime-distributed-ownership.md`
- `docs/plans/release/2026-03-03-webhooks-and-async-jobs.md`
- `docs/plans/release/2026-03-03-release-engineering-and-deployment-gates.md`
- `docs/plans/release/2026-03-04-compliance-data-governance.md`

## Release Roadmap (From Current State To Releasable Backend)

### Phase 0: Release Blocker Hardening (Must Do First)

- Lock mutation actor identity to authenticated viewer scope (remove client-controlled actor IDs for sensitive writes).
- Add strict authz checks for content/social/accounts writes.
- Define API auth contract for mobile (`access + refresh` lifecycle, token rotation/revocation, failure semantics).
- Restrict non-production GraphiQL exposure.
- Add rate limiting and abuse throttles for auth + mutation + channel joins.

Mobile parallel start now:
- Can build app shell, navigation, design system, GraphQL client infrastructure, local persistence, and offline cache strategy.
- Can build read-only screens against existing query contracts (`viewer`, `homeFeed`, `liveNow`, `post`) with mock/fallback mode.
- Should not ship production auth or write flows until this phase lands.

### Phase 1: Authentication And Identity Production Slice

- Finalize supported login methods for v1 launch (email/password + magic link vs additional providers).
- Implement mobile-first auth endpoints/flows (not only web form/session flows).
- Decide and implement provider rollout (Google/Apple/passkey either fully ship or explicitly defer behind flags with no client promise).
- Auth audit expansion is delivered for password/magic-link login outcomes, refresh-token revocation/rotation outcomes, and password/email credential change outcomes; expand further for additional identity lifecycle events (for example provider unlink/account recovery) if they enter v1 scope.

Mobile parallel:
- Start real login/signup/password-reset screens once auth contract is frozen.
- Implement token refresh/expiry UX immediately after backend token semantics are finalized.

### Phase 2: API Contract Stabilization For Social/Content/Feed

- Freeze external API contract (fields, enums, error codes, pagination guarantees).
- Move write APIs to viewer-scoped behavior by default.
- Add missing content lifecycle operations needed for launch UX (for example edit/delete/report paths if required by product).
- Publish a backend-client contract doc for mobile consumption.

Mobile parallel:
- Full feed and social feature integration can run in parallel once this contract is locked.
- QA automation for GraphQL regression can begin at this phase.

### Phase 3: Live/Chat Runtime Productionization

- Distributed live runtime ownership baseline is now delivered (lease table + remote-owner join routing + channel-safe client error mapping).
- Extend the baseline with heartbeat/lease-refresh strategy, multi-node failover drills, and reconnect consistency under partition/rejoin scenarios.
- Add reconnect/rejoin consistency guarantees and conflict resolution rules.
- Add operational limits for chat throughput and moderation actions.
- Decide retention policy for chat/live participation records.

Mobile parallel:
- Start full live room and chat UX integration after runtime ownership and reconnect semantics are defined.
- Load/latency tuning for mobile live UX starts here.

### Phase 4: Media, Storage, And External Integration

- Object-storage serving strategy and provider hardening remain before GA.
- Webhook callback ingress for media processing is now delivered (`POST /api/webhooks/media-processing`).
- Background job retries/idempotent async work is now delivered (`async_jobs` + `LC.Infra.AsyncJobs.Worker`).

Mobile parallel:
- Media upload flow (capture -> upload -> processing -> publish) can be integrated once signed-upload and processing APIs are stable.

### Phase 5: Operations And Launch Readiness

- Production observability: metrics, tracing/log correlation, actionable dashboards/alerts.
- Reliability runbooks: incident handling, rollback, migration safety, backup/restore drills.
- Performance and capacity verification (feed query load, channel fanout, live-session concurrency).
- Release checklist and staged rollout plan (internal dogfood -> beta -> GA).

Mobile parallel:
- Beta hardening, crash/error analytics, release-candidate testing, and app-store launch prep.

## Planning Holes (Missing Or Underspecified Right Now)

The previous webhook/async-job planning hole is now closed by `docs/plans/release/2026-03-03-webhooks-and-async-jobs.md`, the release-engineering deployment-gates hole is now closed by `docs/plans/release/2026-03-03-release-engineering-and-deployment-gates.md`, and the compliance/data-governance planning hole is now closed by `docs/plans/release/2026-03-04-compliance-data-governance.md`. Remaining material gaps without sufficiently detailed executable plans in `docs/plans/` are:

- Additional auth audit expansion for provider unlink/account recovery events if included in v1 launch scope.

## Evidence Notes On Key Blockers

- Auth audit expansion is implemented in `LC.Accounts` (`record_auth_event/2`, `list_user_auth_events/2`, login/revocation/rotation, and credential change emissions in `lib/live_canvas/accounts.ex`) with coverage in `test/live_canvas/accounts/auth_event_test.exs`.
- Live runtime ownership now uses durable leases plus remote-owner routing (`lib/live_canvas/live/session_ownership.ex`, `lib/live_canvas/live/runtime_rpc.ex`, `lib/live_canvas/live/session_supervisor.ex`) with channel-facing `session_unavailable` normalization for remote runtime failures.
- Webhook + async-job delivery is implemented via signed webhook ingress (`lib/live_canvas_web/controllers/webhook_controller.ex`), durable async-job persistence (`lib/live_canvas/infra/async_jobs.ex`), supervised worker processing (`lib/live_canvas/infra/async_jobs/worker.ex`), and integration coverage (`test/integration/media_webhook_async_flow_test.exs`).

## Suggested Next Plan Files To Create

- `docs/plans/release/2026-03-04-auth-audit-provider-recovery-expansion.md`
