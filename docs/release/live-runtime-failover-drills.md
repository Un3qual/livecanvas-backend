# Live Runtime Failover Drills Runbook

Use this runbook to rehearse shard ownership handoff behavior for distributed live session runtimes.

## Owners

- Release Engineer: runs the drill command and captures output evidence.
- Live Runtime Owner: validates shard-owner transitions and reconnect behavior.
- Incident Commander (IC): approves go/no-go after drill evidence review.

## Prerequisites

1. Pick a rehearsal session ID with active traffic simulation and known host/viewer test accounts.
2. Identify the intended takeover node (for example, the standby node for the shard).
3. Run `mix release.gates` and `MIX_ENV=test mix release.migration_drill --step 1` first.

## Command Usage

- Dry run plan (safe preview):
  - `MIX_ENV=test mix release.live_runtime_drill --session-id <session-id> --takeover-node <takeover-node> --dry-run`
- Execute checklist output in sequence:
  - `MIX_ENV=test mix release.live_runtime_drill --session-id <session-id> --takeover-node <takeover-node> --confirm`

`--confirm` is required in non-test environments to prevent accidental disruptive rehearsals.

## Drill Steps

1. Capture current shard owner.
2. Simulate owner-node partition.
3. Force shard ownership takeover on the target node.
4. Run reconnect join probe.
5. Restore topology and verify steady shard owner.

## Required Evidence For Release Ticket

- Command arguments used (`session-id`, `takeover-node`, `MIX_ENV`).
- Dry-run output captured and attached.
- Execution output for each step with timestamp.
- Final shard owner record and routing evidence.
- Reconnect probe result (`success`/`failure`) and participant consistency notes.
