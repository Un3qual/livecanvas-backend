# Compliance Data Governance Runbook

This runbook defines the v1 baseline for data export, account deletion, and retention cleanup.

## Owners

- Incident Commander (IC): final decision maker when governance actions conflict with incident response.
- Compliance Owner: approves policy updates and legal-hold exceptions.
- Data Operator: executes export/deletion/retention commands and records evidence.

## Policy Matrix

| Data Family | Durable Tables | Export Scope | User-Initiated Deletion | Automatic Retention Rule | Legal-Hold Placeholder |
| --- | --- | --- | --- | --- | --- |
| Accounts | `users`, `email_addresses`, `phone_numbers`, `user_*`, `users_tokens`, `auth_events` | Include user profile and account-linked identifiers. Exclude token secrets/hash material. | Deletion request lifecycle is active (request/schedule/complete), but hard row deletion is currently stubbed and deferred. | `auth_events` older than 365 days are retention-sweep candidates unless on hold. | If `legal_hold=true` for a user, skip export expiration and skip deletion/retention purges for that user. |
| Social | `follows`, `blocks`, `mutes` | Include relationship edges owned by requester. | Rows remain untouched while account-deletion hard purge is stubbed. | No time-based purge in baseline; removed only when hard deletion is re-enabled. | Hold blocks relationship purge for held user records. |
| Content | `posts`, `media_assets` | Include posts and media metadata owned by requester. Exclude object-storage binary payloads; export references only. | Rows remain untouched while account-deletion hard purge is stubbed; object-storage deletion remains separately managed. | No automatic DB purge in baseline. | Hold skips owner-row purge. |
| Live | `live_sessions`, `live_participants` | Include sessions hosted by requester and participation records tied to requester. | Rows remain untouched while account-deletion hard purge is stubbed. | `live_participants` retained 180 days; `live_sessions` retained 365 days unless required longer by moderation incidents. | Hold skips live-session/live-participant retention purge and deletion purge. |
| Chat | `chat_messages` | Include requester-authored chat messages and timestamps. | Rows remain untouched while account-deletion hard purge is stubbed. | Retain 180 days, then mark as retention-sweep candidates once moderation holds are cleared. | Hold skips chat purge for held users/sessions. |
| Infra | `webhook_events`, `async_jobs` | Not exported to end users (operational metadata). | Not directly user-owned; governed by retention workflow only. | `webhook_events` terminal rows retained 90 days; `async_jobs` terminal rows retained 30 days; current apply mode is stubbed (non-destructive). | Hold is not user-scoped here; incident hold can globally pause retention task execution. |

## Export Scope Rules

- Export includes user-owned domain entities and metadata needed for portability.
- Export excludes secrets, hashed token material, and internal-only operational telemetry.
- Export payloads reference object-storage artifacts by signed URL metadata instead of embedding binary blobs in Postgres.

## Deletion, Retention, And Rollback Separation

- User-initiated deletion: asynchronous request lifecycle with grace-period scheduling and deterministic purge intent; hard delete execution is currently stubbed.
- Automatic retention purge: table/time-window sweeps for operational and communication records, currently implemented as candidate reporting with stubbed apply mode.
- Operational rollback: use `docs/release/rollback-and-restore.md`; rollback is incident recovery, not a privacy delete mechanism.

## Operator Workflows

### Data Export Fulfillment

1. Confirm request ownership and status is `pending`.
2. Run export executor job to gather user-owned records and write artifact metadata.
3. Mark request `completed` with artifact reference or `failed` with safe failure reason.
4. Capture request ID, job ID, and completion timestamp in the ticket.

### Account Deletion Fulfillment

1. Confirm request ownership and status is `pending` or `scheduled`.
2. Validate grace-period cutoff (`scheduled_purge_at <= now`).
3. Execute the async deletion handler and verify completion metadata (`purge_mode=stubbed`).
4. Mark request `completed` or `failed` with safe metadata; emit auth audit event.

### Retention Sweeper Execution

1. Dry run first (`mix release.retention_sweep --dry-run`); this uses policy defaults per family (`auth_events` 365d, `webhook_events` 90d, `async_jobs` 30d, `chat_messages` 180d, `live_participants` 180d).
2. Use `--cutoff-days <n>` only for explicit uniform-window override drills across all families.
3. Review per-table candidate counts and family cutoff metadata.
4. Apply mode is explicit but currently non-destructive (`mix release.retention_sweep --apply [--cutoff-days <n>]`) and is gated by both `LC.Infra.DataGovernance.Retention.apply_mode_enabled=true` and `incident_hold_active=false`.
5. Record candidate counts, cutoff windows, and legal-hold/incident-hold exceptions; note `deletion_stubbed=true`.

## Baseline Control Requirements

- All governance timestamps use UTC microsecond precision.
- Governance workflows must be idempotent (safe re-run after partial failure).
- Mutations and queries are viewer-scoped; no cross-user governance access in v1.
- Hard deletion remains deferred in this milestone; apply commands must be treated as control-plane rehearsals.
- Retention apply mode must remain disabled by default and only be enabled for controlled operator drills.
- Every run must attach evidence to an operator ticket (request IDs, timestamps, outcomes).
