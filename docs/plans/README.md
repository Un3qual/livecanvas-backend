# Plans Directory Guide

Use this directory for active and in-progress planning artifacts.

## Active Work

- Release roadmap and planning-hole tracker: `docs/plans/2026-03-03-backend-release-readiness-roadmap.md`
- GraphQL live + auth bootstrap implementation: `docs/plans/graphql/2026-03-05-live-mutations-and-auth-bootstrap.md`

## Recently Completed

- Object storage serving strategy + provider hardening: `docs/plans/archive/completed/release/2026-03-05-object-storage-serving-provider-hardening.md` (configurable object-storage adapter/runtime validation plus GraphQL `mediaAsset.publicUrl` delivery with query + Relay node contract coverage)
- Phase 5 capacity verification + launch gate wiring: `docs/plans/archive/completed/release/2026-03-05-phase5-capacity-verification-and-launch-gates.md` (deterministic `mix release.capacity_drill` probes delivered, `mix release.gates` sequencing updated, and capacity runbook guidance published)
- Content post lifecycle mutations: `docs/plans/archive/completed/release/2026-03-05-content-post-lifecycle-mutations.md` (viewer-scoped `updatePost`/`deletePost` delivery with context + Relay regression coverage)
- Live runtime partition/rejoin drills: `docs/plans/archive/completed/release/2026-03-05-live-runtime-partition-rejoin-drills.md` (reconnect consistency hardening, peer-node partition/takeover integration coverage, and `mix release.live_runtime_drill` operator runbook/command delivered)
- Chat/live retention enforcement: `docs/plans/archive/completed/release/2026-03-05-chat-live-retention-enforcement.md` (retention candidate coverage, policy-window alignment, and apply-mode rollout guardrails delivered; hard deletion remains deferred)
- Live chat + moderation operational limits: `docs/plans/archive/completed/release/2026-03-05-live-chat-throughput-and-moderation-rate-limits.md` (channel `chat:send` throughput limits and moderation-mutation-specific GraphQL limits delivered)
- Account-recovery password reset foundation: `docs/plans/archive/completed/release/2026-03-05-account-recovery-password-reset-foundation.md` (Accounts recovery primitives, web reset-password flow, and GraphQL recovery mutations delivered)
- Live runtime heartbeat/failover hardening plan: `docs/plans/archive/completed/release/2026-03-04-live-runtime-heartbeat-and-failover-hardening.md` (lease heartbeat, stale-runtime handoff cleanup, and reconnect-safety regressions delivered)
- Auth audit provider/recovery expansion plan: `docs/plans/archive/completed/release/2026-03-04-auth-audit-provider-recovery-expansion.md` (provider identity unlink coverage delivered; recovery workflow follow-up now landed in the 2026-03-05 plan)

## Execution Pause Notes

- Compliance hard-delete enablement work is paused by operator direction in this session.
- Do not resume compliance hard-delete enablement until that pause is explicitly lifted.

## Deferred Candidates

- Compliance hard-delete enablement remains deferred while the explicit operator pause is active.

## Archived Completed Plans

Checklist-complete plan files are moved to:

- `docs/plans/archive/completed/`

When starting new implementation work, read active plans first and only consult archived plans for historical context.
