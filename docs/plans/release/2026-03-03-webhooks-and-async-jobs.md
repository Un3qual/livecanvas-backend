# Webhooks And Async Jobs Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a production-ready REST webhook ingress and a Postgres-backed async job pipeline so callback-triggered work is durable, idempotent, and retryable.

**Architecture:** Keep webhook transport concerns in `LCWeb` (routing, signature checks, request normalization), then hand off normalized events to `LC.Infra` for durable persistence + enqueue semantics. Use database-backed jobs (`async_jobs`) with explicit state transitions (`pending`, `processing`, `completed`, `failed`) and a supervised worker loop in `LCApp` so retries and idempotency stay deterministic across nodes.

**Tech Stack:** Elixir 1.15, Phoenix, Ecto, PostgreSQL, ExUnit, Dialyzer

---

## Candidate Status Verification (2026-03-03)

Verified before selecting this plan so we do not assume unchecked work is unimplemented:

1. **Additional auth audit expansion (provider unlink/account recovery):** **Missing**.
   - Evidence: roadmap still marks this as a planning hole and current auth event enums/tests do not include provider-unlink or account-recovery events (`docs/plans/2026-03-03-backend-release-readiness-roadmap.md`, `lib/live_canvas_schemas/accounts/auth_event_type.ex`, `test/live_canvas/accounts/auth_event_test.exs`).
2. **REST webhook + async background job slice:** **Missing/partial**.
   - Evidence: no webhook routes/controllers are wired, no job runtime/supervisor exists, and media processing is currently synchronous (`lib/live_canvas_web/router.ex`, `lib/live_canvas_app.ex`, `lib/live_canvas/content.ex`).
3. **Release engineering plan:** **Partial**.
   - Evidence: release hardening artifacts exist, but roadmap still calls out missing rollout/deployment-gate planning (`docs/plans/2026-03-03-backend-release-readiness-roadmap.md`, `docs/plans/release/2026-03-03-observability-and-launch-ops.md`).
4. **Compliance/data-governance plan:** **Missing**.
   - Evidence: retention/deletion/export policy is still listed as a planning hole (`docs/plans/2026-03-03-backend-release-readiness-roadmap.md`).

### Why This Is The Next Batch

The webhook + async job gap is the most direct blocker to Phase 4 architecture goals (REST callbacks + retryable async delivery) and has the clearest incremental implementation path that can ship in milestones.

## Scope And Assumptions

- Keep this plan provider-agnostic but start with a concrete media-processing callback path.
- Use a database-backed queue in `LC.Infra` first; do not add Oban/external brokers in this slice.
- Preserve existing domain boundaries:
  - `LCWeb`: HTTP ingress and signature verification only.
  - `LC.Infra`: persistence + enqueue/claim/retry primitives.
  - `LC.Content`: business handling for media-processing jobs.
- Conventions to enforce in all new schema/migration work:
  - `bigint` primary keys + `entropy_id` UUIDv7 (`uuidv7()`) for relational tables.
  - `:utc_datetime_usec` timestamps.
  - typespecs on public APIs; run `mix typecheck` at each milestone.

## Progress

- [x] Task 1: Add durable webhook-event and async-job persistence primitives
- [x] Task 2: Add signed REST webhook ingress with idempotent event recording
- [x] Task 3: Add supervised async-job worker baseline with retry/backoff handling
- [x] Task 4: Move media finalize processing to async jobs (durable + idempotent)
- [ ] Task 5: Run full verification, update roadmap notes, and finalize milestones

### Task 1: Durable Persistence Primitives (`webhook_events`, `async_jobs`)

**Files:**
- Create: `priv/repo/migrations/20260304000000_create_webhook_events_and_async_jobs.exs`
- Create: `lib/live_canvas_schemas/infra.ex`
- Create: `lib/live_canvas_schemas/infra/webhook_event.ex`
- Create: `lib/live_canvas_schemas/infra/async_job.ex`
- Create: `lib/live_canvas/infra/webhook_event.ex`
- Create: `lib/live_canvas/infra/async_jobs.ex`
- Modify: `lib/live_canvas_schemas.ex`
- Modify: `lib/live_canvas/infra.ex`
- Create: `test/live_canvas/infra/async_jobs_test.exs`
- Modify: `docs/plans/release/2026-03-03-webhooks-and-async-jobs.md`

**Task 1 Step Progress:**
- [x] Step 1: Add failing tests for enqueue/claim/complete/retry + webhook idempotency
- [x] Step 2: Run focused tests to verify RED
- [x] Step 3: Implement migration, schema modules, and minimal `LC.Infra.AsyncJobs` / `LC.Infra.WebhookEvent` APIs
- [x] Step 4: Rebuild test DB (if needed) and run focused tests to verify GREEN
- [x] Step 5: Run `mix compile` + `mix typecheck`, update checklist, and commit Task 1 milestone

**Step 1 test targets:**
- `enqueue/3` inserts a `pending` job with `entropy_id`, `scheduled_at`, and bounded payload map.
- dedupe key prevents duplicate enqueues for the same logical event.
- `claim_due_jobs/2` atomically claims only due + unlocked jobs.
- `mark_completed/2` and `mark_retry/4` transition states deterministically.
- webhook event upsert path is idempotent on `(provider, external_event_id)`.

**Step 2 command:**

```bash
mix test test/live_canvas/infra/async_jobs_test.exs
```

Expected: FAIL due to missing persistence/APIs.

**Step 4 command:**

```bash
MIX_ENV=test mix ecto.migrate --quiet
mix test test/live_canvas/infra/async_jobs_test.exs
```

Expected: PASS.

**Step 5 commit:**

```bash
git add priv/repo/migrations/20260304000000_create_webhook_events_and_async_jobs.exs \
  lib/live_canvas_schemas/infra.ex \
  lib/live_canvas_schemas/infra/webhook_event.ex \
  lib/live_canvas_schemas/infra/async_job.ex \
  lib/live_canvas/infra/webhook_event.ex \
  lib/live_canvas/infra/async_jobs.ex \
  lib/live_canvas_schemas.ex \
  lib/live_canvas/infra.ex \
  test/live_canvas/infra/async_jobs_test.exs \
  docs/plans/release/2026-03-03-webhooks-and-async-jobs.md
git commit -m "feat: add webhook event and async job persistence primitives"
```

### Task 2: Signed Webhook Ingress + Idempotent Event Recording

**Files:**
- Create: `lib/live_canvas_web/controllers/webhook_controller.ex`
- Create: `lib/live_canvas_web/plugs/webhook_signature.ex`
- Modify: `lib/live_canvas/content.ex`
- Modify: `lib/live_canvas_web/endpoint.ex`
- Modify: `lib/live_canvas_web/router.ex`
- Modify: `config/config.exs`
- Modify: `config/test.exs`
- Create: `test/live_canvas_web/controllers/webhook_controller_test.exs`
- Modify: `docs/plans/release/2026-03-03-webhooks-and-async-jobs.md`

**Task 2 Step Progress:**
- [x] Step 1: Add failing controller tests for valid signature, invalid signature, stale timestamp, and duplicate event handling
- [x] Step 2: Run focused tests to verify RED
- [x] Step 3: Implement route + controller + signature plug and `LC.Content` callback-ingest handoff
- [x] Step 4: Run focused tests to verify GREEN
- [x] Step 5: Run `mix compile` + `mix typecheck`, update checklist, and commit Task 2 milestone

**Webhook contract for this slice:**
- Route: `POST /api/webhooks/media-processing`
- Required headers: `x-livecanvas-signature`, `x-livecanvas-timestamp`, `x-livecanvas-event-id`
- Signature algorithm: HMAC-SHA256 over `timestamp <> "." <> raw_body`
- Replay window: reject payloads outside configured max skew
- Response semantics:
  - `202` accepted/new event
  - `200` already processed duplicate (idempotent ack)
  - `401` invalid signature
  - `422` invalid payload shape

**Step 2 command:**

```bash
mix test test/live_canvas_web/controllers/webhook_controller_test.exs
```

Expected: FAIL due to missing route/controller/plug.

**Step 5 commit:**

```bash
git add lib/live_canvas_web/controllers/webhook_controller.ex \
  lib/live_canvas_web/plugs/webhook_signature.ex \
  lib/live_canvas/content.ex \
  lib/live_canvas_web/endpoint.ex \
  lib/live_canvas_web/router.ex \
  config/config.exs \
  config/test.exs \
  test/live_canvas_web/controllers/webhook_controller_test.exs \
  docs/plans/release/2026-03-03-webhooks-and-async-jobs.md
git commit -m "feat: add signed media webhook ingress"
```

### Task 3: Supervised Async Worker Baseline + Retry Semantics

**Files:**
- Create: `lib/live_canvas/infra/async_jobs/worker.ex`
- Create: `lib/live_canvas/infra/async_jobs/handler.ex`
- Modify: `lib/live_canvas_app.ex`
- Modify: `config/config.exs`
- Modify: `config/test.exs`
- Create: `test/live_canvas/infra/async_jobs_worker_test.exs`
- Modify: `docs/plans/release/2026-03-03-webhooks-and-async-jobs.md`

**Task 3 Step Progress:**
- [x] Step 1: Add failing worker tests for claim loop, success ack, retry backoff, and terminal failure behavior
- [x] Step 2: Run focused tests to verify RED
- [x] Step 3: Implement worker polling loop + handler dispatch + retry scheduling
- [x] Step 4: Run focused tests to verify GREEN
- [x] Step 5: Run `mix compile` + `mix typecheck`, update checklist, and commit Task 3 milestone

**Task 3 implementation notes:**
- Keep worker single-responsibility: claim due jobs, dispatch to handler, record result.
- Normalize retry backoff in one function (`next_retry_at/2`) and document invariants.
- Add concise comments around non-obvious race/idempotency protections.
- Keep operations idempotent so duplicate worker picks cannot double-apply effects.

**Step 2 command:**

```bash
mix test test/live_canvas/infra/async_jobs_worker_test.exs
```

Expected: FAIL due to missing worker/dispatch pipeline.

**Step 5 commit:**

```bash
git add lib/live_canvas/infra/async_jobs/worker.ex \
  lib/live_canvas/infra/async_jobs/handler.ex \
  lib/live_canvas_app.ex \
  config/config.exs \
  config/test.exs \
  test/live_canvas/infra/async_jobs_worker_test.exs \
  docs/plans/release/2026-03-03-webhooks-and-async-jobs.md
git commit -m "feat: add async job worker retry baseline"
```

### Task 4: Content Media Processing Async Integration

**Files:**
- Create: `lib/live_canvas/content/media_processing_job.ex`
- Modify: `lib/live_canvas/content.ex`
- Modify: `lib/live_canvas/infra.ex`
- Modify: `config/config.exs`
- Modify: `test/live_canvas/content_test.exs`
- Create: `test/integration/media_webhook_async_flow_test.exs`
- Modify: `docs/plans/release/2026-03-03-webhooks-and-async-jobs.md`

**Task 4 Step Progress:**
- [x] Step 1: Add failing tests showing `finalize_media_upload/3` enqueues async work and preserves idempotent state transitions
- [x] Step 2: Run focused tests to verify RED
- [x] Step 3: Implement async enqueue path and worker handler integration for media processing outcomes
- [x] Step 4: Run focused and integration tests to verify GREEN
- [x] Step 5: Run `mix typecheck`, update checklist, and commit Task 4 milestone

**Task 4 behavior target:**
- `finalize_media_upload/3` durably records upload completion and enqueues processing job.
- Processing success updates `media_assets.processing_state` to `:processed` with metadata.
- Processing failure schedules retry until attempt cap, then marks `:failed`.
- Repeated finalize/webhook events remain safe and idempotent.

**Step 2 command:**

```bash
mix test test/live_canvas/content_test.exs test/integration/media_webhook_async_flow_test.exs
```

Expected: FAIL before async pipeline exists.

**Step 5 commit:**

```bash
git add lib/live_canvas/content/media_processing_job.ex \
  lib/live_canvas/content.ex \
  lib/live_canvas/infra.ex \
  config/config.exs \
  test/live_canvas/content_test.exs \
  test/integration/media_webhook_async_flow_test.exs \
  docs/plans/release/2026-03-03-webhooks-and-async-jobs.md
git commit -m "feat: process media uploads through async job pipeline"
```

### Task 5: Final Verification + Release Roadmap Alignment

**Files:**
- Modify: `docs/plans/release/2026-03-03-webhooks-and-async-jobs.md`
- Modify: `docs/plans/2026-03-03-backend-release-readiness-roadmap.md`

**Task 5 Step Progress:**
- [ ] Step 1: Run full verification (`mix compile`, `mix test`, `mix typecheck`, `mix precommit`)
- [ ] Step 2: Update roadmap planning-hole notes for delivered webhook/async-job scope and remaining follow-ups
- [ ] Step 3: Mark all completed checklist items and commit final milestone

**Step 1 command:**

```bash
mix compile
mix test
mix typecheck
mix precommit
```

Expected: all PASS.

**Step 3 commit:**

```bash
git add docs/plans/release/2026-03-03-webhooks-and-async-jobs.md \
  docs/plans/2026-03-03-backend-release-readiness-roadmap.md
git commit -m "chore: finalize webhook and async jobs release slice"
```
