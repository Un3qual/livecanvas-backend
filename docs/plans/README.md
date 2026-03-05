# Plans Directory Guide

Use this directory for active and in-progress planning artifacts.

## Active Work

- Release roadmap and planning-hole tracker: `docs/plans/2026-03-03-backend-release-readiness-roadmap.md`
- Live runtime partition/rejoin drills: `docs/plans/release/2026-03-05-live-runtime-partition-rejoin-drills.md` (Task 1 reconnect-consistency hardening delivered; peer-node drills and operator runbook tasks remain open)

## Recently Completed

- Chat/live retention enforcement: `docs/plans/release/2026-03-05-chat-live-retention-enforcement.md` (retention candidate coverage, policy-window alignment, and apply-mode rollout guardrails delivered; hard deletion remains deferred)
- Live chat + moderation operational limits: `docs/plans/release/2026-03-05-live-chat-throughput-and-moderation-rate-limits.md` (channel `chat:send` throughput limits and moderation-mutation-specific GraphQL limits delivered)
- Account-recovery password reset foundation: `docs/plans/release/2026-03-05-account-recovery-password-reset-foundation.md` (Accounts recovery primitives, web reset-password flow, and GraphQL recovery mutations delivered)
- Live runtime heartbeat/failover hardening plan: `docs/plans/release/2026-03-04-live-runtime-heartbeat-and-failover-hardening.md` (lease heartbeat, stale-runtime handoff cleanup, and reconnect-safety regressions delivered)
- Auth audit provider/recovery expansion plan: `docs/plans/release/2026-03-04-auth-audit-provider-recovery-expansion.md` (provider identity unlink coverage delivered; recovery workflow follow-up now landed in the 2026-03-05 plan)

## Execution Pause Notes

- Compliance hard-delete enablement work is paused by operator direction in this session.
- Do not start `docs/plans/release/2026-03-04-compliance-hard-delete-enablement.md` until that pause is explicitly lifted.

## Deferred Candidates

- Compliance hard-delete enablement remains deferred while the explicit operator pause is active.

## Archived Completed Plans

Checklist-complete plan files are moved to:

- `docs/plans/archive/completed/`

When starting new implementation work, read active plans first and only consult archived plans for historical context.
