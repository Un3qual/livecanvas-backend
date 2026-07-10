# Mobile Lane NOW

Last reviewed: 2026-07-10
Status: viewer-profile privacy query cleanup active; reversible controls deferred

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**`.
- Promote verified backend contract/data issues into the backend lane with an
  explicit write scope before cross-lane implementation.
- Keep Relay IDs opaque and durable reads/writes Relay-first.

## Current Batch

- Source plan:
  `docs/superpowers/plans/2026-07-10-directional-block-quality-cleanup.md`
- Track: `docs/plans/mobile/TRACK.md`
- Task: keep viewer-owned profile data cache-friendly while moving follower,
  following, and request previews into a network-fresh child boundary.
- Write scope: viewer profile components, shared Relay fetch options, generated
  Relay output, focused profile tests, and this lane pointer.
- Done condition: cached viewer data can render immediately, cached third-party
  identities remain withheld, and the full mobile quality suite passes.

## Deferred Scope

- Social-control Tasks 3-4 remain deferred: backend `unfollowUser`,
  `unblockUser`, a direction-safe blocked-by-viewer read, and their mobile UI.
- Native address-book import and bulk contact upload remain out of scope.
- Contact-invite delivery remains hidden until the emailed token URL has a real
  landing route.
- Release-candidate manual device/account QA remains deferred until product
  explicitly resumes it.

## Next Action

After backend Task 1, execute Task 2 of the current cleanup plan test-first.
Keep unblock, unfollow, contact-invite delivery, and device QA deferred.
