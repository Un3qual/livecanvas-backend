# Development Seed Data Implementation Plan

**Goal:** Add deterministic, idempotent development seed data so `mix ecto.setup` and `mix ecto.reset` produce a usable local dataset with stable accounts, social graph edges, feed content, and a live-session fixture for day-to-day backend and mobile development.

**Architecture:** Move development seeding out of the placeholder `priv/repo/seeds.exs` script into a small `LC.Dev.SeedData` module that can be exercised directly in tests. Use stable natural keys such as known email addresses and fixed content identifiers so rerunning seeds reuses or updates the same records instead of duplicating them, and keep the `priv/repo/seeds.exs` entrypoint explicitly focused on the development environment. Seed durable product data through the public contexts where possible, and fall back to narrowly scoped repo lookups only when a context does not expose the idempotent read path the seed workflow needs.

**Tech Stack:** Elixir 1.15, Phoenix, Ecto, ExUnit

---

## Current State Verification

Verified directly in the codebase before drafting this plan:

1. `priv/repo/seeds.exs` is still the default Phoenix placeholder even though `mix ecto.setup` and `mix ecto.reset` already invoke it via `mix.exs`.
2. The repo has test-only fixtures for accounts, social, and content (`test/support/fixtures/*.ex`), but there is no development/runtime seeding module outside `:test`.
3. The mobile planning docs already call out the need for a local workflow that boots against seeded test accounts (`docs/plans/mobile/2026-03-18-mobile-app-overview-design.md`).
4. Release capacity-drill code creates isolated probe fixtures, but that data is intentionally scoped to test/release verification and is not a reusable local-development dataset.

## Scope Decisions

- Seed development-only data with deterministic identities and rerunnable behavior.
- Cover the smallest product-shaped dataset that gives a primary viewer non-empty auth, social, feed, and live-discovery surfaces.
- Use stable seeded emails plus a documented shared password for local sign-in; do not persist long-lived auth tokens in the seed script.
- Do not import `test/support` fixtures into application code.
- Keep provider identities, moderation edge cases, and heavy media fixtures out of the first slice unless the core local workflow proves they are required.

## Progress

- [x] Task 1: Add a tested, idempotent development seed foundation
- [x] Task 2: Seed a product-shaped local dataset and document the workflow

### Task 1: Add A Tested, Idempotent Development Seed Foundation

**Files:**
- Create: `lib/live_canvas/dev/seed_data.ex`
- Modify: `priv/repo/seeds.exs`
- Create: `test/live_canvas/dev/seed_data_test.exs`


**Task 1 behavior targets:**

- Running the seed entrypoint twice leaves exactly one row per seeded account.
- Seeded users have stable emails and a documented shared password suitable for local login flows.
- The seed module stays outside `test/support` and is safe to call from `priv/repo/seeds.exs`.
- Non-development invocation of the script is explicit and unsurprising.

Expected: PASS.

### Task 2: Seed A Product-Shaped Local Dataset And Document The Workflow

**Files:**
- Modify: `lib/live_canvas/dev/seed_data.ex`
- Modify: `test/live_canvas/dev/seed_data_test.exs`
- Create: `docs/development/seeds.md`


**Task 2 behavior targets:**

- The primary seeded viewer has non-empty `following`, `homeFeed`, and `liveNow` style data to inspect locally.
- Seed reruns remain idempotent and preserve the same natural-key identities.
- Local developers have one obvious command path (`mix ecto.reset`) and one short doc describing the seeded dataset.
- The first slice stays intentionally small and understandable instead of becoming an unbounded fixture dump.

Expected: PASS, with the reset command recreating the documented seeded dataset.
