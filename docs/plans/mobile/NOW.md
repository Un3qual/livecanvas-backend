# Mobile Lane NOW

Last reviewed: 2026-07-15
Status: mobile magic-link authentication active

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**`.
- Consume explicitly promoted backend contracts recorded in the backend lane.
- Keep Relay IDs/cursors opaque and durable reads/writes Relay-first.

## Current Batch

- Design: `docs/superpowers/specs/2026-07-15-mobile-magic-link-auth-design.md`
- Source plan: `docs/superpowers/plans/2026-07-15-mobile-magic-link-auth.md`
- Current scope: Tasks 2-4—strict link parsing and SecureStore handoff, auth
  entry request actions, and login/signup redemption into `AuthProvider`.
- Done condition: no raw credential reaches navigation/startup snapshots, both
  purposes complete through the existing GraphQL contract, and focused/full
  mobile gates pass.
- Operator/device email-link QA remains pending and is not completed here.

## Deferred Scope

- Native address-book import, bulk contact upload, multi-viewer scale, store
  submission, and other checklist-deferred follow-up remain out of scope.

## Verification

- Run focused parser/handoff/client/state/RNTL suites, Relay generation, both
  TypeScript checks, lint, the full Vitest and Jest suites, `nix flake check`,
  and patch hygiene.

## Next Action

Begin Task 2 after the backend landing contract passes focused verification.
