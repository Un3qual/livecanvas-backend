# Current Execution

Last reviewed: 2026-07-10
Status: directional privacy quality cleanup complete; ReadPolicy redesign next as stacked PR

## Purpose

This is the coordinator dashboard. Lane `NOW.md` files own executable details.

## Lane Pointers

### Backend Lane

- Pointer: `docs/plans/backend/NOW.md`
- State: PR #116 contact-projection cleanup is complete and verified; the
  ReadPolicy redesign follows from the pushed cleanup head.
- Completed cleanup plan:
  `docs/superpowers/plans/2026-07-10-directional-block-quality-cleanup.md`
- Queued stacked plan:
  `docs/superpowers/plans/2026-07-10-read-policy-redesign.md`

### Mobile Lane

- Pointer: `docs/plans/mobile/NOW.md`
- State: viewer-profile query-boundary cleanup is complete and verified.
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

## Active Cross-Lane Decision

Push the verified PR #116 cleanup, then branch `codex/read-policy-redesign`
from that exact remote head and publish its PR against
`codex/directional-block-privacy`. Deferred product work stays inactive.

## Repair Conditions

Repair this dashboard when a lane pointer or status stops matching its lane
`NOW.md`, another lane is reprioritized, or shared ownership policy changes.
