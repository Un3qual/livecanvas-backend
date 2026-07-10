# Mobile Lane NOW

Last reviewed: 2026-07-10
Status: viewer-profile privacy query cleanup complete; reversible controls deferred

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**`.
- Promote verified backend contract/data issues into the backend lane with an
  explicit write scope before cross-lane implementation.
- Keep Relay IDs opaque and durable reads/writes Relay-first.

## Recently Completed

- Source plan:
  `docs/superpowers/plans/2026-07-10-directional-block-quality-cleanup.md`
- Track: `docs/plans/mobile/TRACK.md`
- Result: viewer-owned profile data stays cache-friendly while follower,
  following, and request previews refresh in a network-fresh child boundary.
- Write scope: viewer profile components, shared Relay fetch options, generated
  Relay output, focused profile tests, and this lane pointer.
- Verification: Relay generation, TypeScript, ESLint, 457 Bun tests, and 84
  Jest tests passed; real cache coverage withholds stale third-party identities.

## Deferred Scope

- Social-control Tasks 3-4 remain deferred: backend `unfollowUser`,
  `unblockUser`, a direction-safe blocked-by-viewer read, and their mobile UI.
- Native address-book import and bulk contact upload remain out of scope.
- Contact-invite delivery remains hidden until the emailed token URL has a real
  landing route.
- Release-candidate manual device/account QA remains deferred until product
  explicitly resumes it.

## Next Action

No mobile batch is selected. Keep unblock, unfollow, contact-invite delivery,
and device QA deferred.
