# Profile Content Code-Quality Follow-up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the three maintainability findings from the Batch 2 stacked diff without changing product behavior.

**Architecture:** The neutral `content` feature owns post presentation, composer/control state, and post mutations; `feed` consumes those modules. Home pagination keeps only the universal connection map plus refresh state. Post controls compose focused report and owner controllers, expose stable actions separately from state, and let memoized cards compare a per-post view model.

**Tech Stack:** React Native, Expo Router, React Relay, TypeScript, Bun test, Jest/RNTL.

## Global Constraints

- Preserve opaque Relay IDs, request identity guards, refresh retention, owner/report behavior, and existing copy.
- Keep tests under `mobile/tests/**`.
- Do not change generated Relay operation names or backend production code.
- Run focused red-green cycles before the full mobile quality gate.

---

### Task 1: Make `content` the post-domain owner

**Files:**
- Modify: `mobile/eslint.config.mjs`
- Move into `mobile/src/content/`: post presentation, composer state, owner-control state/operations, and report reducer
- Modify: affected `mobile/src/**` and `mobile/tests/**` imports

**Interfaces:**
- Produces: content-owned post presentation and control modules with no `content/** -> feed/**` imports.

- [x] **Step 1: Prove the boundary violation and add a permanent lint guard**
  Use a temporary failing source-boundary test to identify imports from `../feed`, then preserve the constraint as a scoped `no-restricted-imports` rule without coupling tests to filesystem APIs.
- [x] **Step 2: Verify RED**
  Run the temporary boundary test; expect the current imports in `ContentPostCard.tsx` and `usePostControls.ts` to fail.
- [x] **Step 3: Move the modules and update imports**
  Keep behavior and Relay document names unchanged while making `feed` a consumer of `content`.
- [x] **Step 4: Verify GREEN**
  Run lint plus presentation, composer, owner-state, reducer, card, and section suites.
- [x] **Step 5: Commit the dependency-direction milestone**

### Task 2: Collapse Home pagination onto connection state

**Files:**
- Modify: `mobile/src/feed/feedHomePagination.ts`
- Modify: `mobile/src/feed/FeedHomeScreen.tsx`
- Modify: `mobile/tests/feed/feedHomePagination.test.ts`
- Modify: `mobile/tests/feed/FeedHomeScreen.rntl.tsx` only if its public assertions need selector updates

**Interfaces:**
- Produces: `FeedHomePaginationState` with `connections`, `isRefreshing`, and `refreshError`; selectors derive page info, load-more status, base identity, and rows from each connection.

- [ ] **Step 1: Write the failing single-source test**
  Assert that initialized state has no `sections` or `sectionBasePageIdentities`, and update tests to use explicit opaque requests.
- [ ] **Step 2: Verify RED**
  Run `bun test tests/feed/feedHomePagination.test.ts`; expect the redundant-state assertion to fail.
- [ ] **Step 3: Remove the legacy state and action paths**
  Delegate section start/success/error and base replacement exclusively to `contentConnectionReducer`.
- [ ] **Step 4: Verify GREEN**
  Run the pagination and Home RNTL suites.
- [ ] **Step 5: Commit the pagination-state milestone**

### Task 3: Split and stabilize post controls

**Files:**
- Create: `mobile/src/content/postOwnerControlsReducer.ts`
- Create: `mobile/src/content/usePostOwnerControls.ts`
- Create: `mobile/src/content/useReportPostControls.ts`
- Modify: `mobile/src/content/usePostControls.ts`
- Modify: `mobile/src/content/ContentPostCard.tsx`
- Create: `mobile/tests/content/postOwnerControlsReducer.test.ts`
- Modify: `mobile/tests/content/ContentPostCard.rntl.tsx`

**Interfaces:**
- Produces: `PostControls` with stable `actions`, explicit `state`, local `changes`, and a per-post view-state selector used by a memoized card.

- [ ] **Step 1: Write failing reducer and stable-action tests**
  Specify owner edit/delete transitions in a pure reducer and assert that controller action identity survives edit-state updates.
- [ ] **Step 2: Verify RED**
  Run the focused Bun/Jest tests; expect the missing reducer API and current flat controller API to fail.
- [ ] **Step 3: Implement focused controllers and memoized per-post selection**
  Preserve same-tick guards by synchronously mirroring reducer state in refs; keep mutation callbacks unmounted-safe.
- [ ] **Step 4: Verify GREEN**
  Run the reducer, card, section, profile-list, and Home suites plus TypeScript checks.
- [ ] **Step 5: Run final gates and commit**
  Run `bun run test:quality`, `git diff --check`, inspect the final diff, commit, and push the existing branch.
