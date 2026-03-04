# Rollback And Restore Runbook

Use this runbook when staged rollout checks fail or production health regresses after promotion.

## Owners

- Incident Commander (IC): owns incident timeline and rollback decision.
- Release Engineer: executes deployment rollback commands.
- Database Owner: executes migration rollback/restore operations.
- On-call Engineer: validates post-rollback service health.

## Immediate Actions

1. IC declares rollback and freezes further promotions.
2. Release Engineer pauses canary or traffic shifts.
3. On-call Engineer captures current error-rate and latency snapshots in the incident ticket.

## DB-Safe Rollback Sequence

Execute steps in this exact order.

1. Quiesce write traffic.
   - Command: `kubectl -n <namespace> scale deploy/live-canvas-workers --replicas=0`
   - Command: `kubectl -n <namespace> scale deploy/live-canvas-api --replicas=0`
   - Expectation: all writer pods terminate before any schema rollback starts.
2. Verify no active writer pods remain.
   - Command: `kubectl -n <namespace> get pods -l app in (live-canvas-api,live-canvas-workers)`
   - Expectation: no `Running` writer pods.
3. Roll back database migrations (if required by failure mode).
   - Command: `MIX_ENV=prod mix ecto.rollback --step <n>`
   - Expectation: rollback completes without errors; target version matches rollback plan.
4. Deploy previous stable application image.
   - Command: `kubectl -n <namespace> set image deploy/live-canvas-api live-canvas-api=<previous-image>`
   - Command: `kubectl -n <namespace> rollout status deploy/live-canvas-api --timeout=5m`
5. Restore runtime capacity.
   - Command: `kubectl -n <namespace> scale deploy/live-canvas-api --replicas=<steady-state>`
   - Command: `kubectl -n <namespace> scale deploy/live-canvas-workers --replicas=<steady-state>`

## Backup Restore Procedure (If Rollback Is Insufficient)

Run only when migration rollback cannot recover data correctness.

1. Keep API/workers at zero replicas.
2. Restore latest validated backup to replacement database.
   - Command: `pg_restore --clean --if-exists --no-owner --dbname=<target-db> <backup-file>`
3. Repoint application to restored database.
4. Deploy previous stable image and scale up gradually.

## Restore Validation Checks

All checks must pass before incident closure.

- Command: `kubectl -n <namespace> rollout status deploy/live-canvas-api --timeout=5m`
  - Required state: rollout successful.
- Command: `curl -fsS https://<env-host>/healthz`
  - Required state: exit `0` for three checks spaced 2 minutes apart.
- Command: `kubectl -n <namespace> logs deploy/live-canvas-api --since=10m | rg -E "(FATAL|panic|\*\* \(.*Error\))"`
  - Required state: no matches.
- Command: `MIX_ENV=prod mix ecto.migrations`
  - Required state: expected migration version is reported as `up`.

## Ownership Handoff After Recovery

1. Release Engineer hands deployment state and commands run to IC.
2. Database Owner confirms final schema/data state in the incident ticket.
3. On-call Engineer confirms service SLO recovery for 30 minutes.
4. IC marks incident mitigated and schedules postmortem with action items.
