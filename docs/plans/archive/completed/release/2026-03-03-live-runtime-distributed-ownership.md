# Live Runtime Distributed Ownership Implementation Plan

> **Archive status:** Completed or historical plan retained for reference.
> Active execution starts from `docs/plans/NOW.md` and lane-specific `NOW.md` files.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a production-safe multi-pod live runtime ownership model so each live session has exactly one active runtime owner while any pod can deterministically route join requests.

**Architecture:** Persist runtime ownership as a lease row keyed by `live_session_id`, with explicit takeover on lease expiry and best-effort release on shutdown. Keep `LC.Live` as the boundary interface while `SessionSupervisor` coordinates local process lifecycle and node-aware routing decisions using a small RPC adapter. Preserve existing durable participant persistence and runtime rehydration semantics.

**Tech Stack:** Elixir 1.15, Phoenix PubSub/Channels, Ecto, PostgreSQL, ExUnit, Dialyzer

---

## Candidate Status Verification (2026-03-03)

Verified directly in `lib/`, `test/`, and migrations before writing this plan:

1. **Runtime ownership is node-local only**: **Implemented as local Registry lookup, not distributed ownership**.
   - Evidence: `LC.Live.SessionSupervisor` uses local `Registry.lookup/2` and local `DynamicSupervisor`; no node lease or owner-node routing.
2. **No durable runtime ownership lease table/schema exists**: **Not implemented**.
   - Evidence: no schema/migration/modules matching runtime owner lease (`rg -n "runtime_owner|session_owner|live_session_runtime" lib priv/repo/migrations` -> no matches).
3. **Live join path cannot route to remote runtime owner**: **Not implemented**.
   - Evidence: `LC.Live.join_live_session/3` only calls local `ensure_session_server/1`; no `:rpc`/`:erpc` routing path.
4. **No tests for multi-node ownership/takeover semantics**: **Not implemented**.
   - Evidence: existing live tests cover local restart rehydration only (`test/live_canvas/live_test.exs`, `test/live_canvas/live/session_server_test.exs`), no owner-node lease or remote-routing assertions.

## Progress

- [x] Task 1: Add durable runtime ownership lease primitives in `LC.Live`
- [x] Task 2: Integrate lease-aware local ownership into `SessionSupervisor` and `LC.Live`
- [x] Task 3: Add remote-owner routing adapter and boundary-level join/lookup semantics
- [x] Task 4: Expose deterministic channel behavior for remote-owned sessions
- [x] Task 5: Run full verification and update release roadmap notes

### Task 1: Add Durable Runtime Ownership Lease Primitives

**Files:**
- Create: `priv/repo/migrations/20260303230000_create_live_session_runtime_owners.exs`
- Create: `lib/live_canvas_schemas/live/live_session_runtime_owner.ex`
- Create: `lib/live_canvas/live/session_ownership.ex`
- Modify: `lib/live_canvas_schemas/live.ex`
- Test: `test/live_canvas/live/session_ownership_test.exs`
- Modify: `docs/plans/release/2026-03-03-live-runtime-distributed-ownership.md`

**Task 1 Step Progress:**
- [x] Step 1: Add failing tests for lease claim/refresh/release/expiry takeover behavior
- [x] Step 2: Run focused tests to verify RED
- [x] Step 3: Implement migration + schema + ownership API with lease semantics
- [x] Step 4: Run test DB migration and focused tests to verify GREEN
- [x] Step 5: Run `mix compile` + `mix typecheck`, update checklist progress, and commit milestone

**Step 1 details:**
Add tests that prove:
- first claim creates an owner lease row for a session.
- repeated claim by same node refreshes lease expiry.
- claim by different node fails while lease is still active.
- claim by different node succeeds after lease expiry.
- release is idempotent and only clears matching owner lease.

Use deterministic clock injection in `SessionOwnership` so expiry logic can be tested without sleeps.

**Step 2 command:**

```bash
mix test test/live_canvas/live/session_ownership_test.exs
```

Expected: FAIL because persistence and ownership APIs are missing.

**Step 3 implementation notes:**
- Table shape:
  - bigint PK + `entropy_id` UUIDv7 default.
  - `live_session_id` FK (unique).
  - `owner_node` (`text`), `lease_expires_at` (`:utc_datetime_usec`), `heartbeat_at` (`:utc_datetime_usec`).
  - `timestamps(type: :utc_datetime_usec)`.
- Public API (all typespec’d):
  - `claim/3` (`session_id`, `owner_node`, `now`)
  - `refresh/3`
  - `release/2`
  - `get_owner/2`
- Keep ownership writes transactional and conflict-safe (`FOR UPDATE` or conflict-upsert with guarded checks).

**Step 4 commands:**

```bash
MIX_ENV=test mix ecto.migrate --quiet
mix test test/live_canvas/live/session_ownership_test.exs
```

Expected: PASS.

**Step 5 commands + commit:**

```bash
mix compile
mix typecheck
```

Then commit:

```bash
git add priv/repo/migrations/20260303230000_create_live_session_runtime_owners.exs \
  lib/live_canvas_schemas/live/live_session_runtime_owner.ex \
  lib/live_canvas/live/session_ownership.ex \
  lib/live_canvas_schemas/live.ex \
  test/live_canvas/live/session_ownership_test.exs \
  docs/plans/release/2026-03-03-live-runtime-distributed-ownership.md
git commit -m "feat: add live runtime ownership lease primitives"
```

### Task 2: Integrate Lease-Aware Local Ownership Into `SessionSupervisor` And `LC.Live`

**Files:**
- Modify: `lib/live_canvas/live/session_supervisor.ex`
- Modify: `lib/live_canvas/live.ex`
- Test: `test/live_canvas/live_test.exs`
- Test: `test/live_canvas/live/session_supervisor_test.exs` (create if absent)
- Modify: `docs/plans/release/2026-03-03-live-runtime-distributed-ownership.md`

**Task 2 Step Progress:**
- [x] Step 1: Add failing tests for local ownership claim on start/lookup and takeover after expiry
- [x] Step 2: Run focused tests to verify RED
- [x] Step 3: Implement ownership-aware `start_session_server/2`, `lookup_session_server/1`, and stop/release handling
- [x] Step 4: Run focused tests to verify GREEN
- [x] Step 5: Run `mix typecheck`, update checklist progress, and commit milestone

**Step 3 implementation notes:**
- `SessionSupervisor` must claim lease before starting a local session process.
- If active lease is owned by another node, return `{:error, {:owned_by_remote, owner_node}}`.
- If lease is expired, atomically take over and start/recover runtime locally.
- On local stop, best-effort release ownership lease for this node.
- Add concise comments on non-obvious invariants:
  - exactly-one-owner lease, eventually consistent failover via expiry.
  - ownership failure must not corrupt durable participant rows.

### Task 3: Add Remote-Owner Routing Adapter And Boundary Semantics

**Files:**
- Create: `lib/live_canvas/live/runtime_rpc.ex`
- Modify: `lib/live_canvas/live/session_supervisor.ex`
- Modify: `lib/live_canvas/live.ex`
- Test: `test/live_canvas/live/distributed_runtime_test.exs`
- Modify: `docs/plans/release/2026-03-03-live-runtime-distributed-ownership.md`

**Task 3 Step Progress:**
- [x] Step 1: Add failing boundary tests for remote owner join/lookup behavior
- [x] Step 2: Run focused tests to verify RED
- [x] Step 3: Implement RPC adapter + remote routing path for join/lookup when owner is another node
- [x] Step 4: Run focused tests to verify GREEN
- [x] Step 5: Run compile/typecheck and commit milestone

**Step 3 implementation notes:**
- `RuntimeRPC` default implementation wraps `:erpc.call/4`.
- Inject RPC module for tests to avoid real multi-node orchestration in unit tests.
- Remote-ownership contract in `LC.Live`:
  - `lookup_session_server/1` may return local pid or `{:error, {:owned_by_remote, owner_node}}`.
  - `join_live_session/3` routes join command to owner node and preserves existing auth/moderation checks before routing.
- Normalize remote call failures to stable reason atoms (`:remote_unreachable`, `:remote_not_found`, `:remote_timeout`).

### Task 4: Expose Deterministic Channel Behavior For Remote-Owned Sessions

**Files:**
- Modify: `lib/live_canvas_web/channels/live_session_channel.ex`
- Test: `test/live_canvas_web/channels/live_session_channel_test.exs`
- Modify: `docs/plans/release/2026-03-03-live-runtime-distributed-ownership.md`

**Task 4 Step Progress:**
- [x] Step 1: Add failing channel tests for remote-owner join response and telemetry reason mapping
- [x] Step 2: Run focused tests to verify RED
- [x] Step 3: Map distributed runtime errors to stable client reason strings and telemetry reason atoms
- [x] Step 4: Run focused tests to verify GREEN
- [x] Step 5: Run `mix typecheck`, update checklist progress, and commit milestone

**Step 3 behavior targets:**
- `{:error, {:owned_by_remote, _node}}` -> client reason `"session_unavailable"` (retry-safe).
- remote transport failures -> `"session_unavailable"` (no node names leaked to clients).
- telemetry retains internal `reason` atoms for observability.

### Task 5: Final Verification And Release-Roadmap Alignment

**Files:**
- Modify: `docs/plans/release/2026-03-03-live-runtime-distributed-ownership.md`
- Modify: `docs/plans/2026-03-03-backend-release-readiness-roadmap.md`

**Task 5 Step Progress:**
- [x] Step 1: Run final verification (`mix compile`, `mix test`, `mix typecheck`, `mix precommit`)
- [x] Step 2: Update roadmap notes for delivered distributed runtime ownership baseline
- [x] Step 3: Mark tasks complete and commit final milestone

**Step 1 command set:**

```bash
mix compile
mix test
mix typecheck
mix precommit
```

Expected: PASS.
