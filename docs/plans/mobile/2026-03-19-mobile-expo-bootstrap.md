# Mobile Expo Bootstrap Implementation Plan

**Goal:** Create the initial Expo mobile workspace in `mobile/` with an isolated
`flake.nix`-managed toolchain and the `blank-typescript` template generated via
`pnpm dlx create-expo-app`.

**Architecture:** Keep the mobile workspace self-contained under `mobile/` so
the existing Elixir backend root stays free of global Node.js or Nix wiring.
Use Expo's generated project structure as the baseline, expose `pnpm` directly
from the flake for deterministic bootstrap commands, and keep manual edits
limited to the Nix shell, generated metadata normalization, and planning/track
files needed to make the bootstrap traceable.

**Tech Stack:** Nix flakes, Node.js, pnpm, Expo, TypeScript

---

## Current State Verification

Verified directly in the codebase before drafting this plan:

1. The repository currently has no `mobile/` directory and no repo-root Nix or
   JavaScript workspace files.
2. `docs/plans/mobile/TRACK.md` already defines the mobile app as a separate
   track, but it is still marked planning-only.
3. The approved mobile overview already requires Expo and places the future app
   in `mobile/`, so this slice is the first concrete bootstrap step for that
   track.

## Scope Decisions

- Treat the generated Expo scaffold and local Nix shell as the full scope of
  this batch.
- Do not customize routing, shared UI, auth wiring, or GraphQL integration yet.
- Treat this bootstrap as a TDD exception because the work is generator- and
  configuration-driven rather than behavior-first application logic.

## Progress

- [x] Task 1: Add the isolated mobile Nix shell and generate the Expo workspace
- [x] Task 2: Verify the generated workspace and refresh mobile planning docs

### Task 1: Add The Isolated Mobile Nix Shell And Generate The Expo Workspace

**Files:**
- Create: `mobile/flake.nix`
- Create: `mobile/*` (generated Expo scaffold)

**Task 1 Step Progress:**
- [x] Step 1: Add `mobile/flake.nix` with a focused dev shell exposing `nodejs`
  and `pnpm`, plus a flake-provided `pnpm` app for bootstrap commands
- [x] Step 2: Run `nix run path:.#pnpm -- --version` from `mobile/` to prove the
  isolated toolchain resolves
- [x] Step 3: Run `pnpm dlx create-expo-app` through the flake-managed `pnpm`
  path and copy the generated scaffold into `mobile/` after the flake files
  block in-place generation
- [x] Step 4: Inspect the generated workspace for local ignore rules, nested git
  metadata, and other files that need minimal repo integration
- [ ] Step 5: Commit the bootstrap slice once verification is complete

**Suggested verification commands:**

```bash
cd mobile
XDG_CACHE_HOME=/tmp/nix-run-cache nix --extra-experimental-features 'nix-command flakes' run path:.#pnpm -- --version
```

Expected: PASS with a pnpm version string from the isolated shell.

### Task 2: Verify The Generated Workspace And Refresh Mobile Planning Docs

**Files:**
- Modify: `docs/plans/mobile/TRACK.md`
- Modify: `docs/plans/INDEX.md`
- Modify: `mobile/app.json`
- Modify: `mobile/package.json`
- Modify: `.gitignore` (only if the generated project does not already cover the
  required local artifacts)

**Task 2 Step Progress:**
- [x] Step 1: Run `nix run path:.#pnpm -- exec expo --version` from `mobile/`
- [x] Step 2: Run `nix run path:.#pnpm -- exec tsc --noEmit` from `mobile/`
- [x] Step 3: Update the mobile planning pointers to reflect that the bootstrap
  slice now exists and the track is no longer planning-only
- [ ] Step 4: Commit the verified bootstrap milestone

**Suggested verification commands:**

```bash
cd mobile
XDG_CACHE_HOME=/tmp/nix-run-cache nix --extra-experimental-features 'nix-command flakes' run path:.#pnpm -- exec expo --version
XDG_CACHE_HOME=/tmp/nix-run-cache nix --extra-experimental-features 'nix-command flakes' run path:.#pnpm -- exec tsc --noEmit
```

Expected: PASS.
