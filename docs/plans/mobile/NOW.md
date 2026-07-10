# Mobile Lane NOW

Last reviewed: 2026-07-09
Status: directional block-privacy regression active; reversible controls remain deferred

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**`.
- Promote verified backend contract/data issues into the backend lane with an
  explicit write scope before cross-lane implementation.
- Keep Relay IDs opaque and durable reads/writes Relay-first.

## Current Batch

- Source plan:
  `docs/superpowers/plans/2026-07-09-directional-block-privacy.md`
- Track: `docs/plans/mobile/TRACK.md`
- Current task: prove a directionally hidden profile renders only the existing
  generic unavailable screen once the backend returns `node: null`.
- Write scope: focused `mobile/tests/profile/**`, generated Relay output only if
  changed, and this lane pointer.
- Done condition: hidden profiles expose no identity, privacy, relationship,
  live-session, connection, or social-action UI; viewer-owned blocks retain the
  existing `BLOCKED` presentation.
- Verification:
  - From `mobile/`: `bun run relay`
  - From `mobile/`: `bun run test:quality`
  - From repo root: `git diff --check`

## Deferred Scope

- Social-control Tasks 3-4 remain deferred: backend `unfollowUser`,
  `unblockUser`, a direction-safe blocked-by-viewer read, and their mobile UI.
- Native address-book import and bulk contact upload remain out of scope.
- Contact-invite delivery remains hidden until the emailed token URL has a real
  landing route.
- Release-candidate manual device/account QA remains deferred until product
  explicitly resumes it.

## Do This Now

After the backend contract is green, update the profile RNTL regression and run
the mobile verification named in the source plan. Do not implement unblock or
unfollow.
