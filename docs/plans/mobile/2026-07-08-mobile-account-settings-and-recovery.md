# Mobile Account Settings And Recovery Implementation Plan

Date: 2026-07-08
Owner lane: mobile, with one backend contract check
Status: draft ready for review

## Executor Brief

Build the first mobile account and settings surface around the account GraphQL
APIs that already exist: password recovery/reset, identity unlinking, data
export requests, and account deletion request/cancel. Keep the UX small and
functional: signed-out recovery lives in the auth stack, signed-in account
settings lives under `/settings`, and all IDs remain opaque Relay IDs.

This plan is not the active mobile lane batch until `docs/plans/mobile/NOW.md`
selects it. If implemented while PR 110 is still open, avoid the media composer
write scope from that PR.

## Context

- Existing backend mutations include `requestPasswordReset`, `resetPassword`,
  `unlinkViewerIdentity`, `requestViewerDataExport`,
  `requestViewerAccountDeletion`, and `cancelViewerAccountDeletionRequest`.
- Existing backend queries include `viewerDataExportRequests`.
- A reloadable deletion settings view needs one backend query addition:
  `viewerAccountDeletionRequests`.
- Keep account policy decisions out of this batch; expose the current backend
  behavior rather than inventing new retention or deletion rules.

## Tasks

### Task 1: Add viewer account deletion listing contract

Files:
- Modify: `lib/live_canvas_gql/accounts/account_queries.ex`
- Modify: `lib/live_canvas_gql/accounts/data_governance_resolver.ex`
- Test: `test/live_canvas_gql/accounts/account_queries_test.exs`
- Refresh after schema export: `mobile/schema.graphql`

Acceptance criteria:
- [ ] Add a Relay connection field named `viewerAccountDeletionRequests`.
- [ ] Use `LC.Accounts.list_user_account_deletion_requests/1` or the existing
      data-governance query path rather than reading raw foreign keys in the
      resolver.
- [ ] Return an empty connection for unauthenticated requests.
- [ ] Scope every row to the authenticated viewer.
- [ ] Preserve existing request and cancel mutation behavior.

Focused verification:
- From repo root:
  `mix test test/live_canvas_gql/accounts/account_queries_test.exs test/live_canvas_gql/accounts/account_mutations_test.exs`
- From repo root: `mix typecheck`
- From repo root: `mix format`

### Task 2: Add password recovery and reset UX

Files:
- Create: `mobile/app/(auth)/password-recovery.tsx`
- Create: `mobile/app/(auth)/reset-password.tsx`
- Create: `mobile/src/auth/recovery/PasswordRecoveryScreen.tsx`
- Create: `mobile/src/auth/recovery/ResetPasswordScreen.tsx`
- Create: `mobile/src/auth/recovery/passwordRecoveryOperations.ts`
- Create: `mobile/src/auth/recovery/passwordRecoveryState.ts`
- Modify: `mobile/src/auth/AuthEntryScreen.tsx`
- Modify if needed: `mobile/src/config/runtime.ts`
- Test: `mobile/tests/auth/passwordRecoveryState.test.ts`
- Test: `mobile/tests/auth/PasswordRecoveryScreen.test.tsx`
- Test: `mobile/tests/auth/ResetPasswordScreen.test.tsx`
- Test if runtime links change: `mobile/tests/config/runtime.test.ts`

Acceptance criteria:
- [ ] The sign-in surface links to `/password-recovery`.
- [ ] Recovery submits `requestPasswordReset` with uniform success copy that
      does not reveal whether an email exists.
- [ ] Reset submits `resetPassword` using a token from query params when
      present and a paste fallback when not present.
- [ ] Runtime link parsing maps the backend reset path to
      `/reset-password?token=<token>`.
- [ ] Mutation errors remain retryable without clearing user-entered fields.

Focused verification:
- From `mobile/`: `bun test tests/auth/passwordRecoveryState.test.ts`
- From `mobile/`:
  `bun test tests/auth/PasswordRecoveryScreen.test.tsx tests/auth/ResetPasswordScreen.test.tsx`
- From `mobile/`: `bun run relay`

### Task 3: Add account settings read surface and navigation

Files:
- Create: `mobile/app/(app)/settings.tsx`
- Create: `mobile/src/account/accountSettingsOperations.ts`
- Create: `mobile/src/account/accountSettingsState.ts`
- Create: `mobile/src/account/AccountSettingsScreen.tsx`
- Modify: `mobile/src/feed/FeedHomeScreen.tsx`
- Modify if profile exposes the same entry: `mobile/src/profile/ViewerProfileScreen.tsx`
- Test: `mobile/tests/account/accountSettingsState.test.ts`
- Test: `mobile/tests/account/AccountSettingsScreen.test.tsx`
- Test updated entry points under `mobile/tests/feed/**` or
  `mobile/tests/profile/**`

Acceptance criteria:
- [ ] `/settings` queries the viewer, linked identities, data export requests,
      and account deletion requests.
- [ ] The home or viewer profile surface exposes a settings navigation action.
- [ ] Identity, export, and deletion rows use viewer-safe status labels.
- [ ] Missing or empty sections render stable empty states.

Focused verification:
- From `mobile/`: `bun test tests/account/accountSettingsState.test.ts`
- From `mobile/`: `bun test tests/account/AccountSettingsScreen.test.tsx`
- From `mobile/`: run the focused entry-point tests that changed.

### Task 4: Wire account settings mutations

Files:
- Modify: `mobile/src/account/accountSettingsOperations.ts`
- Modify: `mobile/src/account/AccountSettingsScreen.tsx`
- Modify generated Relay files under `mobile/src/__generated__/**`
- Test: `mobile/tests/account/AccountSettingsScreen.test.tsx`

Acceptance criteria:
- [ ] `unlinkViewerIdentity` is available only for linked identities that the
      backend allows to be removed.
- [ ] `requestViewerDataExport` starts a new export request and refreshes the
      request list.
- [ ] `requestViewerAccountDeletion` and
      `cancelViewerAccountDeletionRequest` refresh the deletion request list.
- [ ] Duplicate taps are guarded per action.
- [ ] Structured payload errors render without decoding GraphQL IDs.

Focused verification:
- From `mobile/`: `bun test tests/account/AccountSettingsScreen.test.tsx`
- From `mobile/`: `bun run relay`

## Final Verification

- From repo root, if Task 1 changed backend GraphQL:
  `mix test test/live_canvas_gql/accounts/account_queries_test.exs test/live_canvas_gql/accounts/account_mutations_test.exs`
- From repo root, if backend typed code changed: `mix typecheck`
- From `mobile/`: `bun run relay`
- From `mobile/`: `bun run typecheck`
- From `mobile/`: `bun run typecheck:tests`
- From `mobile/`: `bun run test:quality`
- From repo root: `git diff --check`

## Handoff

After this lands, account settings still need product decisions for preferences,
notification controls, and account security history. Those should be separate
plans so this batch stays focused on existing account lifecycle contracts.
