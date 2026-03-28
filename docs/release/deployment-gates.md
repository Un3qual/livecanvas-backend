# Deployment Gates Runbook

This runbook defines the release go/no-go checks that must pass before any production promotion.

## Owners

- Incident Commander (IC): owns final go/no-go decision and escalation path.
- Release Engineer: executes release commands and reports gate results.
- Database Owner: owns migration safety and rollback feasibility checks.

## Gate Checklist

| Gate | Owner | Command | Success Criterion | Blocker Severity |
| --- | --- | --- | --- | --- |
| Preflight quality gate | Release Engineer | `mix release.gates` | Command exits `0`; compile/test/typecheck/boundary checks and `mix release.capacity_drill --confirm` all pass in order. | P0 |
| Migration rehearsal gate | Database Owner | `MIX_ENV=test mix release.migration_drill --step 1` | Command exits `0`; create/migrate/rollback/migrate sequence completes without intervention. | P0 |
| Runtime failover rehearsal gate | Release Engineer + Live Runtime Owner | `MIX_ENV=test mix release.live_runtime_drill --session-id <id> --takeover-node <node> --confirm` | Command exits `0`; all five drill steps complete and reconnect probe succeeds without ghost participants. | P1 |
| Observability contract smoke gate | Release Engineer + On-call Engineer | `curl -fsS -H "Authorization: Bearer ${METRICS_ENDPOINT_TOKEN}" https://<env-host>/ops/metrics | rg "phoenix_router_dispatch_stop_duration_bucket|live_canvas_live_channel_join_count|live_canvas_accounts_auth_password_login_failed_count"` and `kubectl -n <namespace> logs deploy/live-canvas-api --since=10m | rg "request_id=.*trace_id="` | Authorized scrape returns the concrete HTTP, live-channel, and auth metric families documented in `docs/release/observability-metrics.md`; logs from rollout smoke traffic include `request_id` and `trace_id`, and any exercised live-session smoke path can be correlated with `viewer_id` and `live_session_id`. | P1 |
| Gate order audit (dry run) | Release Engineer | `mix release.gates --dry-run`, `MIX_ENV=test mix release.capacity_drill --dry-run`, `MIX_ENV=test mix release.migration_drill --dry-run --step 1`, and `MIX_ENV=test mix release.live_runtime_drill --session-id <id> --takeover-node <node> --dry-run` | Output lists deterministic ordered command plan that matches this runbook. | P1 |
| Working tree integrity | Release Engineer | `git status --short` | Output is empty before tagging/publishing a release candidate from the branch tip. | P1 |

Capacity thresholds and override policy live in `docs/release/performance-capacity-verification.md`. Metric names, scrape auth, and correlation fields live in `docs/release/observability-metrics.md`.

## Gate Execution Order

1. Run the preflight quality gate.
2. Run the migration rehearsal gate.
3. Run the runtime failover rehearsal gate.
4. Run the observability contract smoke gate against the candidate environment and attach the scrape/log evidence to the release ticket.
5. Run the gate order audit and attach output to the release ticket.
6. Confirm working tree integrity.
7. IC marks release as `GO` only after all P0/P1 blockers are cleared.

## Blocking Policy

- `P0`: hard stop; promotion is prohibited.
- `P1`: stop by default; IC may override only with documented mitigation and explicit owner acceptance.

## Evidence Capture Template

Record this in the release ticket for every run:

- Commit SHA:
- Release Engineer:
- Database Owner:
- IC:
- `mix release.gates` result:
- `mix release.capacity_drill --confirm` result:
- `mix release.migration_drill --step 1` result:
- `mix release.live_runtime_drill --session-id <id> --takeover-node <node> --confirm` result:
- `/ops/metrics` smoke result:
- Correlation metadata spot-check (`request_id`, `trace_id`, `viewer_id`, `live_session_id`) result:
- Capacity override arguments (if any):
- Dry-run output attached:
- Final decision (`GO` or `NO-GO`):
