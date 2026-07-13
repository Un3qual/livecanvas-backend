# Native Module Import Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace test-driven runtime dynamic imports with static Expo adapter imports.

**Architecture:** App-facing modules statically bind Expo native APIs and delegate behavior to dependency-injected core modules. Bun tests import only the cores, avoiding native-module parsing and global mocks.

**Tech Stack:** Expo 55, React Native, TypeScript, Bun tests, Jest Expo

## Global Constraints

- Preserve current contact-invite persistence, locking, expiry, and error semantics.
- Preserve current media-picker validation and viewer-safe errors.
- Do not add new Bun-specific production accommodations.

---

### Task 1: Separate contact-invite handoff core from its native adapter

**Files:**
- Create: `mobile/src/contacts/contactInviteHandoffCore.ts`
- Create: `mobile/src/contacts/contactInviteNativeLink.ts`
- Modify: `mobile/src/contacts/contactInviteHandoff.ts`
- Modify: `mobile/src/contacts/contactInviteLink.ts`
- Modify: `mobile/app/+native-intent.ts`
- Test: `mobile/tests/contacts/contactInviteHandoff.test.ts`

**Interfaces:**
- Core consumes explicit `storage` and `createHandoffId` dependencies.
- Native adapter preserves the existing app-facing function signatures.

- [x] Point the unit test at the not-yet-created core and verify the focused test fails.
- [x] Move handoff behavior into the core and require its platform dependencies.
- [x] Implement static SecureStore and Crypto imports in the native adapter.
- [x] Keep parsing and redaction pure while routing native-intent persistence through the native adapter.
- [x] Run `bun test tests/contacts/contactInviteHandoff.test.ts tests/contacts/contactInviteNativeIntent.test.ts` and expect all tests to pass.

### Task 2: Separate media-selection core from its native adapter

**Files:**
- Create: `mobile/src/content/mediaPostSelectionCore.ts`
- Modify: `mobile/src/content/mediaPostSelection.ts`
- Test: `mobile/tests/content/mediaPostSelection.test.ts`

**Interfaces:**
- Core exposes `pickPostMediaWithPicker(picker)` and the existing media types.
- Native adapter exposes the existing zero-argument `pickPostMedia()` function.

- [x] Point the unit test at the not-yet-created core and verify the focused test fails.
- [x] Move selection and normalization behavior into the core.
- [x] Implement a static ImagePicker import in the native adapter.
- [x] Run `bun test tests/content/mediaPostSelection.test.ts` and expect all tests to pass.

### Task 3: Verify and publish

**Files:**
- Modify: this plan to check completed steps.

- [x] Confirm no runtime dynamic imports remain in `mobile/src` or `mobile/app`.
- [x] Run `bun run typecheck`, `bun run typecheck:tests`, `bun run lint`, and `bun run test:quality` from `mobile/`.
- [x] Run `git diff --check` before publishing the implementation and documentation together.
