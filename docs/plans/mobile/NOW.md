# Mobile Lane NOW

Last reviewed: 2026-07-09
Status: Batch 1 reversible social controls complete

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**`.
- Consume explicitly promoted backend contracts recorded in the backend lane.
- Keep Relay IDs opaque and durable reads/writes Relay-first.

## Completed Batch

- Design:
  `docs/superpowers/specs/2026-07-09-next-five-product-batches-design.md`
- Implementation:
  `docs/superpowers/plans/2026-07-09-reversible-social-controls.md`
- Source product plan:
  `docs/plans/mobile/2026-07-08-mobile-social-controls.md`
- Track: `docs/plans/mobile/TRACK.md`
- Delivered Unfollow for accepted outbound relationships and Unblock only for
  viewer-originated blocks.
- Guarded duplicate/cross-action taps and stale route completions; payload
  errors remain local and retryable.

## Verification

- `bun run relay`: 48 reader, 44 normalization, and 44 operation documents;
  no resulting artifact diff.
- Focused pure route/presentation suites: 9 tests, 0 failures.
- Focused profile RNTL suite: 11 tests, 0 failures, including A -> B -> A stale
  mutation completion coverage.
- `bun run test:quality`: both typechecks and lint passed; 457 Bun tests and 87
  Jest tests passed.

## Deferred Scope

- Batches 2-5 remain queued and are not executable without their own approved
  implementation plans.
- Native address-book import and bulk contact upload remain out of scope.
- Release-candidate manual device/account QA remains deferred until all five
  product batches close.

## Next Action

No mobile batch is executable. The coordinator should plan Batch 2, Profile
Content Surfaces, before promoting new mobile work.
