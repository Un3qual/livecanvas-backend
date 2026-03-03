# Media Storage And Processing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver the first production-ready media pipeline slice by adding signed-upload intent issuance, Relay media node access, and upload finalization hooks while keeping external storage processing abstracted behind infra seams.

**Architecture:** Keep `LC.Content` as the domain boundary for media lifecycle transitions, use `LC.Infra.ObjectStorage` for provider-agnostic signed-upload contracts, and keep GraphQL adapter logic in `LCGQL.Content`. Use viewer-scoped mutations only, server-generate storage keys, and preserve Relay node/global-id semantics.

**Tech Stack:** Elixir 1.15, Phoenix, Ecto, Absinthe Relay, ExUnit, Dialyzer

---

## Candidate Status Verification (2026-03-03)

Verified directly in `lib/`, `priv/repo/migrations/`, `config/`, and tests before selecting this plan:

1. Signed upload intent API: **Not implemented**.
   - Evidence: `LCGQL.Content.Mutations` only exposes `createPost` (`lib/live_canvas_gql/content/content_mutations.ex`).
2. Relay media node/query surface: **Not implemented**.
   - Evidence: no `:media_asset` node type and no media node fetch branch in `LCGQL.Schema` (`lib/live_canvas_gql/schema.ex`).
3. Object-storage adapter seam: **Not implemented**.
   - Evidence: `LC.Infra` only exports `Repo`, `Mailer`, `SMS` (`lib/live_canvas/infra.ex`).
4. Upload finalization and processing kickoff in `LC.Content`: **Not implemented**.
   - Evidence: `LC.Content` only has `create_post/2`, `create_media_asset/2`, and post getters (`lib/live_canvas/content.ex`).

## Progress

- [x] Task 1: Add object-storage seam and `Content.request_media_upload/2`
- [ ] Task 2: Add Relay `requestMediaUpload` mutation and media node/query surface
- [ ] Task 3: Add `Content.finalize_media_upload/3` lifecycle transition and processing seam
- [ ] Task 4: Run final verification and update roadmap links

### Task 1: Add Object-Storage Seam And `Content.request_media_upload/2`

**Files:**
- Create: `lib/live_canvas/infra/object_storage.ex`
- Create: `lib/live_canvas/infra/object_storage/fake_adapter.ex`
- Create: `test/live_canvas/infra/object_storage/fake_adapter_test.exs`
- Modify: `lib/live_canvas/infra.ex`
- Modify: `config/config.exs`
- Modify: `lib/live_canvas/content.ex`
- Modify: `lib/live_canvas/content/media_asset.ex`
- Modify: `lib/live_canvas_schemas/content.ex`
- Modify: `lib/live_canvas_schemas/content/media_asset.ex`
- Modify: `test/live_canvas/content_test.exs`

**Task 1 Step Progress:**
- [x] Step 1: Add failing tests for `request_media_upload/2` and object-storage fake adapter contract
- [x] Step 2: Run focused tests to verify RED
- [x] Step 3: Implement minimal object-storage seam and `request_media_upload/2`
- [x] Step 4: Run focused tests to verify GREEN
- [x] Step 5: Run `mix typecheck`, update checklist progress, and commit Task 1 milestone

**Step 2 verification run (2026-03-03):**
- `mix test test/live_canvas/content_test.exs test/live_canvas/infra/object_storage/fake_adapter_test.exs` -> FAIL (`LC.Infra.ObjectStorage.sign_upload/1` and `LC.Content.request_media_upload/2` undefined)

**Step 4 verification run (2026-03-03):**
- `mix test test/live_canvas/content_test.exs test/live_canvas/infra/object_storage/fake_adapter_test.exs` -> PASS (`6 tests, 0 failures`)

**Step 5 verification run (2026-03-03):**
- `mix typecheck` -> PASS

**Step 1 details:**
Add tests that prove:
- Content request path is viewer-owned and server-generates `storage_key`.
- New media row starts in `:pending_upload`.
- Object-storage contract includes method/url/headers required for direct client upload.

**Step 2 command:**

```bash
mix test test/live_canvas/content_test.exs test/live_canvas/infra/object_storage/fake_adapter_test.exs
```

Expected: FAIL because request API and object-storage seam do not exist yet.

**Step 3 implementation notes:**
- Keep storage-key generation deterministic in shape and non-guessable in value.
- Add brief comments on non-obvious invariants (server-owned key generation and observability-safe payload shape).
- Keep changes scoped to Task 1 only (no GraphQL mutation yet).

**Step 4 command:**

```bash
mix test test/live_canvas/content_test.exs test/live_canvas/infra/object_storage/fake_adapter_test.exs
```

Expected: PASS.

**Step 5 commands + commit:**

```bash
mix typecheck
git add lib/live_canvas/infra/object_storage.ex lib/live_canvas/infra/object_storage/fake_adapter.ex test/live_canvas/infra/object_storage/fake_adapter_test.exs lib/live_canvas/infra.ex config/config.exs lib/live_canvas/content.ex lib/live_canvas/content/media_asset.ex lib/live_canvas_schemas/content.ex lib/live_canvas_schemas/content/media_asset.ex test/live_canvas/content_test.exs docs/plans/2026-03-03-media-storage-and-processing.md
git commit -m "feat: add media upload intent and object storage seam"
```

### Task 2: Add Relay `requestMediaUpload` Mutation And Media Node/Query Surface

**Files:**
- Modify: `lib/live_canvas_gql/content/content_mutations.ex`
- Modify: `lib/live_canvas_gql/content/content_types.ex`
- Modify: `lib/live_canvas_gql/content/content_queries.ex`
- Modify: `lib/live_canvas_gql/content/content_resolver.ex`
- Modify: `lib/live_canvas_gql/schema.ex`
- Modify: `test/live_canvas_gql/content/content_mutations_test.exs`
- Modify: `test/live_canvas_gql/content/content_queries_test.exs`
- Modify: `test/live_canvas_gql/relay/node_queries_test.exs`
- Modify: `docs/plans/2026-03-03-media-storage-and-processing.md`

**Task 2 Step Progress:**
- [ ] Step 1: Add failing GraphQL tests for `requestMediaUpload` and media node/query lookups
- [ ] Step 2: Run focused GraphQL tests to verify RED
- [ ] Step 3: Implement minimal Relay schema and resolver wiring
- [ ] Step 4: Run focused GraphQL tests to verify GREEN
- [ ] Step 5: Run `mix typecheck`, update checklist progress, and commit Task 2 milestone

### Task 3: Add `Content.finalize_media_upload/3` Lifecycle Transition And Processing Seam

**Files:**
- Create: `lib/live_canvas/content/media_processing.ex`
- Modify: `lib/live_canvas/content.ex`
- Modify: `config/config.exs`
- Modify: `test/live_canvas/content_test.exs`
- Modify: `docs/plans/2026-03-03-media-storage-and-processing.md`

**Task 3 Step Progress:**
- [ ] Step 1: Add failing tests for finalize authorization, idempotency, and state transitions
- [ ] Step 2: Run focused tests to verify RED
- [ ] Step 3: Implement minimal finalize + processing seam
- [ ] Step 4: Run focused tests to verify GREEN
- [ ] Step 5: Run `mix typecheck`, update checklist progress, and commit Task 3 milestone

### Task 4: Final Verification And Roadmap Update

**Files:**
- Modify: `docs/plans/2026-03-03-media-storage-and-processing.md`
- Modify: `docs/plans/2026-03-03-backend-release-readiness-roadmap.md`

**Task 4 Step Progress:**
- [ ] Step 1: Mark completed checklist items in this plan file
- [ ] Step 2: Update roadmap with delivered scope and remaining follow-ups
- [ ] Step 3: Run verification (`mix compile`, `mix test`, `mix typecheck`, `mix precommit`)
- [ ] Step 4: Commit final milestone with code/tests/plan updates together
