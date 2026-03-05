# Object Storage Serving Strategy And Provider Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the remaining Phase 4 launch gap by hardening object-storage provider configuration for production environments and defining a canonical media-serving URL strategy that clients can consume safely.

**Architecture:** Keep object-storage concerns behind `LC.Infra.ObjectStorage`, add a production-oriented configurable adapter with runtime env validation, and extend the storage contract with explicit public asset URL generation. Keep domain write paths in `LC.Content` unchanged for this first slice, then expose the serving URL through GraphQL in a follow-up task.

**Tech Stack:** Elixir 1.15, Phoenix, Ecto, Absinthe Relay, ExUnit

---

## Candidate Status Verification (2026-03-05)

Verified directly in active code/config/docs before selecting this batch:

1. **Object-storage provider hardening:** **Missing**.
   - Evidence: app-wide object storage still defaults to `LC.Infra.ObjectStorage.FakeAdapter` with placeholder `.invalid` URLs and no prod runtime env requirement (`config/config.exs`, `lib/live_canvas/infra/object_storage/fake_adapter.ex`, `config/runtime.exs`).
2. **Media-serving URL strategy:** **Missing in storage contract**.
   - Evidence: `LC.Infra.ObjectStorage` only supports upload-signing; there is no public URL function for serving media (`lib/live_canvas/infra/object_storage.ex`).
3. **Roadmap gap alignment:** **Still open**.
   - Evidence: roadmap continues to track "Object-storage serving strategy and provider hardening remain before GA" (`docs/plans/2026-03-03-backend-release-readiness-roadmap.md`).

## Progress

- [ ] Task 1: Add hardened object-storage contract and production adapter/runtime config
- [x] Task 1: Add hardened object-storage contract and production adapter/runtime config
- [ ] Task 2: Expose canonical media asset public URL in GraphQL and add contract tests
- [ ] Task 3: Final verification and roadmap/index tracking updates

### Task 1: Add Hardened Object-Storage Contract And Production Adapter/Runtime Config

**Files:**
- Create: `lib/live_canvas/infra/object_storage/configurable_adapter.ex`
- Create: `test/live_canvas/infra/object_storage/configurable_adapter_test.exs`
- Modify: `lib/live_canvas/infra/object_storage.ex`
- Modify: `lib/live_canvas/infra/object_storage/fake_adapter.ex`
- Modify: `test/live_canvas/infra/object_storage/fake_adapter_test.exs`
- Modify: `config/config.exs`
- Modify: `config/runtime.exs`
- Modify: `docs/plans/release/2026-03-05-object-storage-serving-provider-hardening.md`

**Task 1 Step Progress:**
- [x] Step 1: Add failing tests for configurable adapter URL generation/validation and new public URL contract
- [x] Step 2: Run focused object-storage tests to verify RED
- [x] Step 3: Implement configurable adapter + `ObjectStorage.public_asset_url/1` contract and production runtime wiring
- [x] Step 4: Run focused object-storage tests to verify GREEN
- [x] Step 5: Run `mix compile` + `mix typecheck`, update checklist progress, and commit milestone

Verification evidence (2026-03-05):

- `mix test test/live_canvas/infra/object_storage/fake_adapter_test.exs test/live_canvas/infra/object_storage/configurable_adapter_test.exs` -> RED first (`6 tests, 4 failures`) due missing public URL contract/configurable adapter; GREEN after implementation (`6 tests, 0 failures`)
- `mix compile` -> PASS
- `mix typecheck` -> PASS (`Total errors: 0, Skipped: 0, Unnecessary Skips: 0`)

### Task 2: Expose Canonical Media Asset Public URL In GraphQL

**Files:**
- Modify: `lib/live_canvas/content.ex`
- Modify: `lib/live_canvas_gql/content/content_types.ex`
- Modify: `lib/live_canvas_gql/content/content_resolver.ex`
- Modify: `test/live_canvas_gql/content/content_queries_test.exs`
- Modify: `test/live_canvas_gql/relay/node_queries_test.exs`
- Modify: `docs/plans/release/2026-03-05-object-storage-serving-provider-hardening.md`

**Task 2 Step Progress:**
- [ ] Step 1: Add failing GraphQL tests for `mediaAsset.publicUrl` in query and Relay node surfaces
- [ ] Step 2: Run focused GraphQL tests to verify RED
- [ ] Step 3: Implement viewer-safe public URL resolver path via `LC.Infra.ObjectStorage.public_asset_url/1`
- [ ] Step 4: Run focused GraphQL tests to verify GREEN
- [ ] Step 5: Run touched GraphQL/content test slices + `mix typecheck`, update checklist progress, and commit milestone

### Task 3: Final Verification And Tracking Updates

**Files:**
- Modify: `docs/plans/2026-03-03-backend-release-readiness-roadmap.md`
- Modify: `docs/plans/README.md`
- Modify: `docs/plans/release/2026-03-05-object-storage-serving-provider-hardening.md`

**Task 3 Step Progress:**
- [ ] Step 1: Mark checklist progress and capture verification evidence
- [ ] Step 2: Update roadmap/index with delivered scope and remaining follow-ups
- [ ] Step 3: Run final verification (`mix compile`, focused `mix test`, `mix typecheck`, `mix precommit`)
- [ ] Step 4: Commit final milestone
