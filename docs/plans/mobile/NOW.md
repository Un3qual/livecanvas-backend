# Mobile Lane NOW

Last reviewed: 2026-07-09
Status: no selected batch; directional privacy complete and reversible controls deferred

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**`.
- Promote verified backend contract/data issues into the backend lane with an
  explicit write scope before cross-lane implementation.
- Keep Relay IDs opaque and durable reads/writes Relay-first.

## Recently Completed

- Source plan:
  `docs/superpowers/plans/2026-07-09-directional-block-privacy.md`
- Track: `docs/plans/mobile/TRACK.md`
- Result: directionally hidden profiles render only the generic unavailable
  state. A real Relay Environment regression proves a cached identity remains
  behind Suspense until the network returns `node: null`; hidden profiles expose
  no identity, privacy, relationship, live-session, connection, or social UI.
- Verification evidence:
  - `bun run relay`: passed with no generated drift.
  - `bun run test:quality`: passed; Bun 457 tests and Jest 83 tests, 0 failures.
  - Focused real-cache privacy regression: passed.
  - `git diff --check`: passed.

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
and release-candidate device QA deferred until product explicitly resumes them.
