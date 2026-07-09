# Mobile Lane NOW

Last reviewed: 2026-07-09
Status: mobile product-gap batch complete; reversible social controls and release QA deferred

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**`.
- Promote verified backend contract/data issues into the backend lane with an
  explicit write scope before cross-lane implementation.
- Keep Relay IDs opaque and durable reads/writes Relay-first.

## Current Batch

- Source plans:
  - `docs/plans/mobile/2026-07-08-mobile-account-settings-and-recovery.md`
  - `docs/plans/mobile/2026-07-08-mobile-social-controls.md` (Tasks 1-2)
  - `docs/plans/mobile/2026-07-08-mobile-contact-discovery.md`
  - `docs/plans/mobile/2026-07-08-mobile-post-owner-controls.md`
  - `docs/plans/mobile/2026-07-08-mobile-profile-connection-lists.md`
- Track: `docs/plans/mobile/TRACK.md`
- Current task: none; implementation and PR review hardening are complete.
- Write scope: `mobile/**`, `docs/plans/mobile/**`, and the explicitly promoted
  backend account/contact contracts recorded in `docs/plans/backend/NOW.md`.
- Done condition: met for account lifecycle, mute/unmute/block, manual contact
  discovery and invites, post owner controls, connection lists, and review
  hardening for cross-action races and virtualized pagination.
- Verification:
  - From `mobile/`: `bun run relay`
  - From `mobile/`: `bun run test:quality`
  - From repo root: `git diff --check`

## Deferred Scope

- Social-control Tasks 3-4 remain deferred: backend `unfollowUser`,
  `unblockUser`, a direction-safe blocked-by-viewer read, and their mobile UI.
- Native address-book import and bulk contact upload remain out of scope.
- Release-candidate manual device/account QA remains deferred until product
  explicitly resumes it.

## Do This Now

No executable mobile batch is selected. Promote or write the next
product-completeness plan before implementation; do not treat the deferred
social or release-QA work as implicitly active.
