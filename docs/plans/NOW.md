# Current Execution

Last reviewed: 2026-07-09
Status: cross-lane product-gap batch complete; next product batch not selected

## Purpose

This is the coordinator dashboard. Lane `NOW.md` files own executable details.

## Lane Pointers

### Backend Lane

- Pointer: `docs/plans/backend/NOW.md`
- State: complete; report moderation plus promoted account/contact contracts
  are implemented and review-hardened.
- Latest source plan:
  `docs/plans/moderation/2026-07-08-report-moderation-operations.md`

### Mobile Lane

- Pointer: `docs/plans/mobile/NOW.md`
- State: complete; the five July 8 product-gap plans are implemented for their
  selected scopes and review-hardened.
- Track: `docs/plans/mobile/TRACK.md`
- Deferred: reversible unfollow/unblock contracts and release-candidate manual
  QA, plus contact-invite delivery until a real landing route exists.

## Execution Rule

Open the relevant lane pointer first. Use `docs/plans/INDEX.md` only when a lane
is stale, blocked, empty, or needs a new plan promoted.

## Cross-Lane Policy

Do not defer a reproduced backend contract, resolver, runtime, or data issue
solely because the visible surface is mobile. Promote it into the backend lane,
state the write scope, and verify both affected sides.

## Next Coordinator Decision

Select the next product-completeness batch. Do not implicitly activate the
deferred reversible social-control work or release-candidate device QA.

## Repair Conditions

Repair this dashboard when a lane pointer or status stops matching its lane
`NOW.md`, another lane is reprioritized, or shared ownership policy changes.
