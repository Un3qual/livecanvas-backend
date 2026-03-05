# Plans Directory Guide

Use this directory for active and in-progress planning artifacts.

## Active Work

- Release roadmap and planning-hole tracker: `docs/plans/2026-03-03-backend-release-readiness-roadmap.md`
- Account-recovery password reset foundation: `docs/plans/release/2026-03-05-account-recovery-password-reset-foundation.md`

## Recently Completed

- Live runtime heartbeat/failover hardening plan: `docs/plans/release/2026-03-04-live-runtime-heartbeat-and-failover-hardening.md` (lease heartbeat, stale-runtime handoff cleanup, and reconnect-safety regressions delivered)
- Auth audit provider/recovery expansion plan: `docs/plans/release/2026-03-04-auth-audit-provider-recovery-expansion.md` (provider identity unlink coverage delivered; account-recovery audit scope remains deferred)

## Execution Pause Notes

- Compliance hard-delete enablement work is paused by operator direction in this session.
- Do not start `docs/plans/release/2026-03-04-compliance-hard-delete-enablement.md` until that pause is explicitly lifted.

## Deferred Candidates

- Account-recovery auth audit expansion remains coupled to the concrete password-reset workflow rollout in `docs/plans/release/2026-03-05-account-recovery-password-reset-foundation.md`.

## Archived Completed Plans

Checklist-complete plan files are moved to:

- `docs/plans/archive/completed/`

When starting new implementation work, read active plans first and only consult archived plans for historical context.
