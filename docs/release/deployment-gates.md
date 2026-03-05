# Deployment Gates Runbook

This runbook defines the release go/no-go checks that must pass before any production promotion.

## Owners

- Incident Commander (IC): owns final go/no-go decision and escalation path.
- Release Engineer: executes release commands and reports gate results.
- Database Owner: owns migration safety and rollback feasibility checks.

## Gate Checklist

| Gate | Owner | Command | Success Criterion | Blocker Severity |
| --- | --- | --- | --- | --- |
| Preflight quality gate | Release Engineer | `mix release.gates` | Command exits `0`; compile/test/typecheck/boundary checks all pass in order. | P0 |
| Migration rehearsal gate | Database Owner | `MIX_ENV=test mix release.migration_drill --step 1` | Command exits `0`; create/migrate/rollback/migrate sequence completes without intervention. | P0 |
| Runtime failover rehearsal gate | Release Engineer + Live Runtime Owner | `MIX_ENV=test mix release.live_runtime_drill --session-id <id> --takeover-node <node> --confirm` | Command exits `0`; all five drill steps complete and reconnect probe succeeds without ghost participants. | P1 |
| Gate order audit (dry run) | Release Engineer | `mix release.gates --dry-run`, `MIX_ENV=test mix release.migration_drill --dry-run --step 1`, and `MIX_ENV=test mix release.live_runtime_drill --session-id <id> --takeover-node <node> --dry-run` | Output lists deterministic ordered command plan that matches this runbook. | P1 |
| Working tree integrity | Release Engineer | `git status --short` | Output is empty before tagging/publishing a release candidate from the branch tip. | P1 |

## Gate Execution Order

1. Run the preflight quality gate.
2. Run the migration rehearsal gate.
3. Run the runtime failover rehearsal gate.
4. Run the gate order audit and attach output to the release ticket.
5. Confirm working tree integrity.
6. IC marks release as `GO` only after all P0/P1 blockers are cleared.

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
- `mix release.migration_drill --step 1` result:
- `mix release.live_runtime_drill --session-id <id> --takeover-node <node> --confirm` result:
- Dry-run output attached:
- Final decision (`GO` or `NO-GO`):
