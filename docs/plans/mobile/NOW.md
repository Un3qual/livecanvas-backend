# Mobile Lane NOW

Last reviewed: 2026-07-15
Status: mobile magic-link authentication complete; device QA pending

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**`.
- Consume explicitly promoted backend contracts recorded in the backend lane.
- Keep Relay IDs/cursors opaque and durable reads/writes Relay-first.

## Current Batch

- Design: `docs/superpowers/specs/2026-07-15-mobile-magic-link-auth-design.md`
- Source plan: `docs/superpowers/plans/2026-07-15-mobile-magic-link-auth.md`
- Completed scope: Tasks 2-4 delivered strict link parsing and SecureStore
  handoff, auth-entry request actions, and login/signup redemption into
  `AuthProvider`.
- Result: no raw credential reaches navigation/startup snapshots, both
  purposes complete through the existing GraphQL contract, and focused/full
  mobile gates pass.
- Operator/device email-link QA remains pending and is not completed here.

## Deferred Scope

- Native address-book import, bulk contact upload, multi-viewer scale, store
  submission, and other checklist-deferred follow-up remain out of scope.

## Verification

- Frozen pnpm installation and Relay generation pass under the Nix shell.
- Both TypeScript checks and lint pass.
- Full Vitest suite: 81 files, 610 tests passed.
- Full Jest/RNTL suite: 29 suites, 208 tests passed.
- `nix flake check` passes on aarch64-darwin.

## Next Action

Run physical-device sign-in and sign-up email-link QA from the release-candidate
checklist; leave manual evidence unchecked until it is observed.
