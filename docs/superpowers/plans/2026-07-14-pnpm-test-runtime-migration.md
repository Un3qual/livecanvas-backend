# Pnpm Test Runtime Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Bun from the active mobile toolchain and preserve both mobile test suites behind one pnpm quality gate.

**Architecture:** Pnpm orchestrates Vitest for `*.test.*` unit files and the existing Jest/Expo configuration for `*.rntl.tsx` rendering files. Vitest setup owns the shared React Native stub; tests with dependency-graph mocks use `vi.doMock` plus dynamic imports, and per-case factories reset the module cache explicitly.

**Tech Stack:** pnpm 10.32.1, Vitest, Jest 29 with jest-expo 55, TypeScript 5.9, Expo 55.

## Global Constraints

- Preserve all 552 unit tests and all 165 Jest tests; do not delete or weaken assertions.
- Do not change production runtime behavior or refactor production code for the runner.
- Remove active Bun commands, `bun:test` imports, Bun typings, and Bun cache workarounds.
- Keep tests under `mobile/tests/**`; keep RNTL files on Jest/Expo.
- Update only active release docs and the new migration artifacts, not historical evidence.

---

## Executor Brief

Work from `mobile/` unless a step says repo root. Convert the harness from the
outside in and commit each green boundary. When a Vitest migration exposes a
real test-isolation bug, fix the mock lifecycle rather than serializing the
whole suite or adding a Bun compatibility helper.

### Task 1: Establish the pnpm and Vitest boundary

**Files:**
- Modify: `mobile/package.json`
- Modify: `mobile/pnpm-lock.yaml`
- Create: `mobile/vitest.config.ts`
- Modify: `mobile/tsconfig.tests.json`
- Modify: `mobile/tests/setup/reactNative.ts`
- Modify: `mobile/tests/config/environment.test.ts`

**Interfaces:**
- Produces: `pnpm test:unit`, `pnpm test:jest`, `pnpm test`, and `pnpm test:quality` commands.
- Produces: Vitest setup that stubs the React Native boundary before unit modules load.

- [x] Run `pnpm test:unit tests/config/environment.test.ts`; verify it fails because `test:unit` does not exist.
- [x] Add Vitest as a development dependency, remove `@types/bun`, and replace the package scripts with pnpm-orchestrated `test:unit`, `test:jest`, `test`, and `test:quality` commands.
- [x] Add `vitest.config.ts` with Node environment, `tests/**/*.test.{ts,tsx,js}` inclusion, the shared setup file, and mock restoration.
- [x] Change `tsconfig.tests.json` to Vitest types; convert the setup mock to `vi.mock` and the environment test to `vitest` imports.
- [x] Run `pnpm test:unit tests/config/environment.test.ts`; expect 4 passing tests.
- [x] Lint the converted boundary files, run `git diff --check`, and commit with `build: add pnpm vitest test boundary`. Full test typecheck resumes after every Bun import is removed in Task 4.

### Task 2: Convert ordinary unit tests and function mocks

**Files:**
- Modify: every `mobile/tests/**/*.test.{ts,tsx,js}` file still importing `bun:test` except the eleven module-mock files owned by Tasks 3 and 4.
- Modify specifically for function mocks: `mobile/tests/auth/authMutationClient.test.ts`, `mobile/tests/auth/authProviderLifecycle.test.ts`, and `mobile/tests/auth/sessionBootstrap.test.ts`.

**Interfaces:**
- Consumes: Vitest imports and `vi.fn` from Task 1.
- Produces: runner-neutral ordinary unit tests with no Bun APIs.

- [x] Replace each ordinary `bun:test` import with the same named APIs from `vitest`.
- [x] Replace callable Bun `mock(...)` usages with `vi.fn(...)` and import `vi`; do not introduce a compatibility wrapper.
- [x] Run Vitest against the converted file set while excluding the eleven module-mock files; verify every selected test passes.
- [x] Run `git diff --check` and commit with `test: migrate unit tests to vitest`.

### Task 3: Convert fixed dependency-graph module mocks

**Files:**
- Modify: `mobile/tests/auth/ViewerBootstrap.test.tsx`
- Modify: `mobile/tests/config/runtime.test.ts`
- Modify: `mobile/tests/contacts/contactInviteNativeIntent.test.ts`
- Modify: `mobile/tests/live/LiveDiscoveryScreen.test.ts`
- Modify: `mobile/tests/live/LiveSessionChatPanel.test.ts`
- Modify: `mobile/tests/live/liveSessionViewerPlaybackSurface.test.tsx`
- Modify: `mobile/tests/live/liveSessionWatchHostControls.test.ts`
- Modify: `mobile/tests/live/liveSessionWatchRecordingCard.test.tsx`

**Interfaces:**
- Consumes: Vitest setup and direct Vitest primitives.
- Produces: fixed module factories installed before the existing top-level dynamic imports.

- [x] Replace `mock.module` with `vi.doMock`, callable mocks with `vi.fn`, and Bun imports with Vitest imports.
- [x] Preserve declaration-before-mock ordering and top-level dynamic imports so factories never depend on hoist-sensitive uninitialized values.
- [x] Remove or rewrite comments that describe Bun process-wide mock leakage.
- [x] Run Vitest against these eight files together; verify all pass without order dependence.
- [x] Run `git diff --check` and commit with `test: migrate module mocks to vitest`.

### Task 4: Replace Bun cache bypasses with explicit module isolation

**Files:**
- Modify: `mobile/tests/auth/authenticatedFetch.concurrent.test.ts`
- Modify: `mobile/tests/realtime/phoenixSocket.test.ts`
- Modify: `mobile/tests/relay/environment.test.ts`

**Interfaces:**
- Produces: stable-path dynamic imports with `vi.doMock` factories and `vi.resetModules` lifecycle cleanup.

- [x] Convert Bun imports and function mocks to Vitest.
- [x] Replace random `?test=${crypto.randomUUID()}` imports with stable module paths.
- [x] Register each case-specific dependency with `vi.doMock`, reset the module cache between cases, restore spies, and continue restoring `globalThis.fetch` where applicable.
- [x] Run these three files together, then repeat them once to prove cache-independent behavior.
- [x] Run the complete `pnpm test:unit`; expect 74 files and 552 tests passing.
- [x] Run `pnpm typecheck:tests` and commit with `test: make vitest module isolation explicit`.

### Task 5: Close the active gate and update PR evidence

**Files:**
- Modify: `docs/plans/mobile/2026-06-25-release-candidate-checklist.md`
- Modify: `docs/plans/mobile/NOW.md`
- Modify: `docs/plans/NOW.md`
- Modify: this plan's checkboxes as work completes.

**Interfaces:**
- Produces: one current release command, `pnpm test:quality`, and durable evidence for PR #123.

- [x] Search active mobile code/config for `bun:test`, `bun-types`, `test:bun`, `bun run`, and `bun test`; verify no active toolchain reference remains.
- [x] Run `pnpm test:quality`; require typechecks, lint, 552 Vitest tests, and 165 Jest tests to pass.
- [x] Run `pnpm typecheck`, `pnpm install --frozen-lockfile`, and repo-root `git diff --check`.
- [x] Update the release checklist and lane pointers from Bun counts/commands to pnpm/Vitest evidence while preserving earlier dated historical entries.
- [x] Re-run `pnpm test:quality` and `git diff --check` after documentation changes, mark this plan complete, and commit with `docs: record pnpm quality gate`.
- [x] Push the branch, refresh PR #123 metadata/checks, and update its title/body to describe both the release gate and Bun removal.
