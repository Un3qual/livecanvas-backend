# LiveCanvas Backend Release Readiness Roadmap (2026-03-03)

## Snapshot

- Scope audited: `ARCHITECTURE.md`, `docs/architecture/conventions.md`, all files in `docs/plans/**`, core `lib/**`, migrations, and tests.
- Verification run on this snapshot:
  - `mix compile` -> PASS
  - `mix test` -> PASS (`426 tests, 0 failures, 1 excluded`)
  - `mix typecheck` -> PASS
  - `mix precommit` -> PASS
- Plan tracking state: release-track plans now include delivered account-recovery password reset coverage, live chat/moderation rate-limit hardening, live runtime partition/rejoin drill coverage, viewer-scoped post lifecycle mutations, object-storage serving/provider hardening, Phase 5 capacity verification + launch-gate wiring, and the observability metrics/correlation contract (`docs/plans/archive/completed/release/2026-03-05-account-recovery-password-reset-foundation.md`, `docs/plans/archive/completed/release/2026-03-05-live-chat-throughput-and-moderation-rate-limits.md`, `docs/plans/archive/completed/release/2026-03-05-live-runtime-partition-rejoin-drills.md`, `docs/plans/archive/completed/release/2026-03-05-content-post-lifecycle-mutations.md`, `docs/plans/archive/completed/release/2026-03-05-object-storage-serving-provider-hardening.md`, `docs/plans/archive/completed/release/2026-03-05-phase5-capacity-verification-and-launch-gates.md`) alongside media upload callback-driven async processing, deployment/rollback runbooks, and the release-ready observability runbook (`docs/plans/2026-03-03-media-storage-and-processing.md`, `docs/plans/archive/completed/release/2026-03-03-webhooks-and-async-jobs.md`, `docs/plans/archive/completed/release/2026-03-03-release-engineering-and-deployment-gates.md`, `docs/release/observability-metrics.md`).

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
  - viewer-scoped Relay post lifecycle writes (`updatePost`, `deletePost`)
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

Observability baseline now includes Telemetry instrumentation for live session lifecycle outcomes, live channel join/chat outcomes, and auth lifecycle parity events (`[:live_canvas, :accounts, :auth, <event_type>]`), a gated Prometheus-compatible `/ops/metrics` surface, HTTP/GraphQL/channel correlation fields (`request_id`, `trace_id`, `viewer_id`, `live_session_id`), and rollout-ready operator guidance in `docs/release/observability-metrics.md`.

Compliance baseline implementation is now in place: policy/runbook docs plus viewer-scoped export and account-deletion request workflows are delivered, and retention baseline execution is exposed via `mix release.retention_sweep` (with apply-mode deletion intentionally stubbed for now).

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
- `docs/plans/archive/completed/release/2026-03-03-auth-audit-events.md`
- `docs/plans/archive/completed/release/2026-03-03-auth-audit-expansion.md`
- `docs/plans/archive/completed/release/2026-03-03-observability-and-launch-ops.md`
- `docs/plans/archive/completed/release/2026-03-27-observability-metrics-and-correlation.md`
- `docs/plans/archive/completed/release/2026-03-03-live-runtime-distributed-ownership.md`
- `docs/plans/archive/completed/release/2026-03-03-webhooks-and-async-jobs.md`
- `docs/plans/archive/completed/release/2026-03-03-release-engineering-and-deployment-gates.md`
- `docs/plans/archive/completed/release/2026-03-04-compliance-data-governance.md`
- `docs/plans/archive/completed/release/2026-03-05-account-recovery-password-reset-foundation.md`
- `docs/plans/archive/completed/release/2026-03-05-content-post-lifecycle-mutations.md`
- `docs/plans/archive/completed/release/2026-03-05-object-storage-serving-provider-hardening.md`
- `docs/plans/archive/completed/release/2026-03-05-phase5-capacity-verification-and-launch-gates.md`

## Release Roadmap (From Current State To Releasable Backend)

### Phase 0: Release Blocker Hardening (Must Do First)

- Lock mutation actor identity to authenticated viewer scope (remove client-controlled actor IDs for sensitive writes).
- Add strict authz checks for content/social/accounts writes.
- Mobile API auth contract is now delivered with access/refresh lifecycle, refresh-token rotation/revocation, and stable failure semantics across GraphQL auth entry points.
- Restrict non-production GraphiQL exposure.
- Abuse throttles for auth, GraphQL mutations, and channel joins are now cluster-aware through deterministic owner-node routing with local fail-open fallback.

Mobile parallel start now:
- Can build app shell, navigation, design system, GraphQL client infrastructure, local persistence, and offline cache strategy.
- Can build read-only screens against existing query contracts (`viewer`, `homeFeed`, `liveNow`, `post`) with mock/fallback mode.
- Should not ship production auth or write flows until this phase lands.

### Phase 1: Authentication And Identity Production Slice

- Supported v1 login methods are now fixed to password, magic link, Google, Apple, and passkey.
- Mobile-first auth endpoints are now delivered through GraphQL `beginAuthChallenge`, `signUp`, and `logIn` flows instead of relying only on browser form/session routes.
- Provider rollout is now implemented end-to-end for Google, Apple, and passkey with dedicated verification/persistence paths rather than deferred flags.
- Auth audit expansion is delivered for password/magic-link login outcomes, refresh-token revocation/rotation outcomes, password/email credential change outcomes, provider identity unlink outcomes, and account-recovery request/reset outcomes.

Mobile parallel:
- Real login/signup/password-reset screens can now integrate against the shipped auth contract.
- Token refresh and expiry UX can proceed against the delivered access/refresh lifecycle.

### Phase 2: API Contract Stabilization For Social/Content/Feed

- Freeze external API contract (fields, enums, error codes, pagination guarantees).
- The mobile-facing GraphQL contract is now published in `docs/contracts/mobile-graphql-phase2.md`, including the supported auth entrypoints, viewer-scoped social reads, and Relay expectations.
- Viewer-scoped social stabilization is now delivered for `relationshipState`, `isMuted`, `followers`, and `following`, and the legacy auth mutations have been removed from the schema.
- Move write APIs to viewer-scoped behavior by default.
- Content edit/delete lifecycle operations are now delivered via viewer-scoped `updatePost`/`deletePost`; report-path follow-up remains product-dependent.
- Publish a backend-client contract doc for mobile consumption (`docs/contracts/mobile-graphql-phase2.md`) that enumerates the supported auth entrypoints, viewer-scoped social read fields, and removed legacy mutations.

Mobile parallel:
- Full feed and social feature integration can run in parallel once this contract is locked.
- QA automation for GraphQL regression can begin at this phase.

### Phase 3: Live/Chat Runtime Productionization

- Distributed live runtime ownership baseline is now delivered (lease table + remote-owner join routing + channel-safe client error mapping).
- Heartbeat/lease-refresh hardening and stale-local-runtime handoff routing are now delivered via `docs/plans/archive/completed/release/2026-03-04-live-runtime-heartbeat-and-failover-hardening.md`.
- Multi-node failover drills and reconnect consistency under partition/rejoin scenarios are now delivered via `docs/plans/archive/completed/release/2026-03-05-live-runtime-partition-rejoin-drills.md` (`test/integration/live/runtime_partition_rejoin_test.exs`, `mix release.live_runtime_drill`).
- Reconnect/rejoin behavior is now validated through real peer-node partition/takeover coverage plus operator-facing failover rehearsal runbook/command.
- Operational limits for chat throughput and moderation actions are now delivered via `docs/plans/archive/completed/release/2026-03-05-live-chat-throughput-and-moderation-rate-limits.md`.
- Retention policy for chat/live participation records is documented; implementation enforcement remains follow-up work.

Mobile parallel:
- Start full live room and chat UX integration after runtime ownership and reconnect semantics are defined.
- Load/latency tuning for mobile live UX starts here.

### Phase 4: Media, Storage, And External Integration

- Object-storage serving strategy and provider hardening are now delivered via `docs/plans/archive/completed/release/2026-03-05-object-storage-serving-provider-hardening.md` (`LC.Infra.ObjectStorage.ConfigurableAdapter`, runtime config validation, and GraphQL `mediaAsset.publicUrl` contract).
- Webhook callback ingress for media processing is now delivered (`POST /api/webhooks/media-processing`).
- Background job retries/idempotent async work is now delivered (`async_jobs` + `LC.Infra.AsyncJobs.Worker`).

Mobile parallel:
- Media upload flow (capture -> upload -> processing -> publish) can be integrated once signed-upload and processing APIs are stable.

### Phase 5: Operations And Launch Readiness

- Production observability is now delivered through the app metric catalog in `LCWeb.Telemetry`, the gated `/ops/metrics` scrape surface, request/trace correlation across HTTP/GraphQL/channels, and operator guidance in `docs/release/observability-metrics.md`.
- Reliability runbooks: incident handling, rollback, migration safety, backup/restore drills.
- Performance and capacity verification (feed query load, channel fanout, live-session concurrency) is now delivered via `mix release.capacity_drill`, `mix release.gates`, and runbook guidance in `docs/release/performance-capacity-verification.md`.
- Release checklist and staged rollout plan now reference concrete HTTP/live/auth metric families and correlation fields in `docs/release/deployment-gates.md` and `docs/release/staged-rollout.md`.

Mobile parallel:
- Beta hardening, crash/error analytics, release-candidate testing, and app-store launch prep.

## Planning Holes (Missing Or Underspecified Right Now)

The previous webhook/async-job planning hole is now closed by `docs/plans/archive/completed/release/2026-03-03-webhooks-and-async-jobs.md`, the release-engineering deployment-gates hole is now closed by `docs/plans/archive/completed/release/2026-03-03-release-engineering-and-deployment-gates.md`, the compliance/data-governance planning hole is now closed by `docs/plans/archive/completed/release/2026-03-04-compliance-data-governance.md`, and the object-storage serving/provider hardening hole is now closed by `docs/plans/archive/completed/release/2026-03-05-object-storage-serving-provider-hardening.md`.

Remaining tracked gaps:

- Chat/live participation retention enforcement is now tracked by `docs/plans/archive/completed/release/2026-03-05-chat-live-retention-enforcement.md`; Tasks 1-3 (candidate coverage, policy-window alignment, and apply-mode guardrails) are delivered, while destructive hard-delete execution remains deferred.
- Compliance hard-delete enablement follow-up remains intentionally paused by operator direction; do not resume until that pause is explicitly lifted.

## Evidence Notes On Key Blockers

- Auth audit expansion is implemented in `LC.Accounts` (`record_auth_event/2`, `list_user_auth_events/2`, login/revocation/rotation, credential change emissions, provider identity unlink outcomes, and account-recovery request/reset outcomes in `lib/live_canvas/accounts.ex`) with transport coverage in `lib/live_canvas_web/controllers/user_reset_password_controller.ex` and `lib/live_canvas_gql/accounts/account_resolver.ex`, plus tests in `test/live_canvas/accounts/auth_event_test.exs`, `test/live_canvas/accounts_test.exs`, `test/live_canvas_web/controllers/user_reset_password_controller_test.exs`, `test/live_canvas_gql/accounts/account_mutations_test.exs`, and `test/live_canvas_gql/accounts/account_queries_test.exs`.
- Mobile auth entry points are implemented in `LC.Accounts` and `LCGQL.Accounts` through `begin_passkey_challenge/2`, `sign_up_with_passkey/1`, `log_in_with_passkey/1`, provider-token flows, and the shared GraphQL `beginAuthChallenge`/`signUp`/`logIn` mutations, with credential persistence in `lib/live_canvas_schemas/accounts/user_passkey.ex` plus coverage in `test/live_canvas/accounts/passkeys_test.exs`, `test/live_canvas_gql/accounts/account_mutations_test.exs`, and `test/live_canvas/accounts/provider_auth_test.exs`.
- Live runtime ownership now uses durable leases plus remote-owner routing and lease heartbeat refresh (`lib/live_canvas/live/session_ownership.ex`, `lib/live_canvas/live/runtime_rpc.ex`, `lib/live_canvas/live/session_supervisor.ex`, `lib/live_canvas/live/session_server.ex`) with channel-facing `session_unavailable` normalization for remote runtime failures and stale-local-runtime handoff cleanup.
- Runtime partition/rejoin drill hardening is implemented via reconnect-consistency join safeguards in `LC.Live.join_live_session/4`, real peer-node partition/takeover integration coverage (`test/integration/live/runtime_partition_rejoin_test.exs`), and operator-facing deterministic drill planning/task support (`lib/live_canvas/release/live_runtime_drill.ex`, `lib/mix/tasks/release.live_runtime_drill.ex`, `docs/release/live-runtime-failover-drills.md`).
- Phase 5 capacity verification is implemented via deterministic probe planning/execution (`lib/live_canvas/release/capacity_drill.ex`, `lib/mix/tasks/release.capacity_drill.ex`), release-gate integration (`lib/live_canvas/release/gates.ex`), and runbook evidence/override guidance (`docs/release/performance-capacity-verification.md`, `docs/release/deployment-gates.md`).
- Phase 5 observability metrics and correlation are implemented via the app metric catalog (`lib/live_canvas_web/telemetry.ex`), the gated scrape surface (`lib/live_canvas_web/plugs/metrics_auth.ex`, `lib/live_canvas_web/router.ex`, `config/runtime.exs`), correlation plumbing (`lib/live_canvas_web/plugs/observability_context.ex`, `lib/live_canvas_gql/context.ex`, `lib/live_canvas_web/channels/user_socket.ex`, `lib/live_canvas_web/channels/live_session_channel.ex`), and operator runbooks (`docs/release/observability-metrics.md`, `docs/release/deployment-gates.md`, `docs/release/staged-rollout.md`) with focused coverage in `test/live_canvas_web/telemetry_test.exs`, `test/live_canvas_web/controllers/metrics_endpoint_test.exs`, `test/live_canvas_web/plugs/observability_context_test.exs`, `test/live_canvas_gql/context_test.exs`, and `test/live_canvas_web/channels/live_session_channel_test.exs`.
- Webhook + async-job delivery is implemented via signed webhook ingress (`lib/live_canvas_web/controllers/webhook_controller.ex`), durable async-job persistence (`lib/live_canvas/infra/async_jobs.ex`), supervised worker processing (`lib/live_canvas/infra/async_jobs/worker.ex`), and integration coverage (`test/integration/media_webhook_async_flow_test.exs`).
- Operational abuse limits are implemented through cluster-aware `LCWeb.RateLimiter` owner routing for auth logins (`:auth_login`), GraphQL mutations (`:graphql_mutation` and `:moderation_action`), channel joins (`:channel_join`), and chat sends (`:chat_send`), with transport enforcement in `lib/live_canvas_web/controllers/user_session_controller.ex`, `lib/live_canvas_web/plugs/graphql_mutation_rate_limit.ex`, and `lib/live_canvas_web/channels/live_session_channel.ex`, plus coverage in `test/live_canvas_web/controllers/user_session_rate_limit_test.exs`, `test/live_canvas_gql/relay/graphql_rate_limit_test.exs`, `test/live_canvas_web/channels/live_session_channel_test.exs`, and `test/live_canvas_web/rate_limiter_test.exs`.
- Content lifecycle writes now include viewer-scoped post update/delete APIs in `LC.Content` plus Relay mutations in `LCGQL.Content` (`lib/live_canvas/content.ex`, `lib/live_canvas_gql/content/content_mutations.ex`, `lib/live_canvas_gql/content/content_resolver.ex`) with regression coverage in `test/live_canvas/content_test.exs` and `test/live_canvas_gql/content/content_mutations_test.exs`.
- Object-storage provider hardening is implemented via configurable adapter/runtime validation and canonical serving URL generation (`lib/live_canvas/infra/object_storage/configurable_adapter.ex`, `config/runtime.exs`, `lib/live_canvas/infra/object_storage.ex`), with GraphQL delivery through `mediaAsset.publicUrl` in `lib/live_canvas_gql/content/content_types.ex` + `lib/live_canvas_gql/content/content_resolver.ex` and coverage in `test/live_canvas/infra/object_storage/configurable_adapter_test.exs`, `test/live_canvas_gql/content/content_queries_test.exs`, and `test/live_canvas_gql/relay/node_queries_test.exs`.
- Compliance data governance baseline is now implemented via `LC.Infra.DataGovernance` export/deletion flows and `LC.Infra.DataGovernance.Retention` (`mix release.retention_sweep`) with coverage in `test/live_canvas/infra/data_governance_export_test.exs`, `test/live_canvas/infra/data_governance_deletion_test.exs`, and `test/live_canvas/infra/data_governance_retention_test.exs`; hard deletion is intentionally stubbed pending follow-up controls.

## Suggested Next Plan Files To Create

- `docs/plans/release/2026-03-04-compliance-hard-delete-enablement.md` (paused; keep as deferred candidate only)
