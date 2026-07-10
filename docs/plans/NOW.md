# Current Execution

Last reviewed: 2026-07-09
Status: directional block-privacy fix active across backend and mobile

## Purpose

This is the coordinator dashboard. Lane `NOW.md` files own executable details.

## Lane Pointers

### Backend Lane

- Pointer: `docs/plans/backend/NOW.md`
- State: active; directional block visibility is being enforced at GraphQL
  profile, social-control, relationship, and contact-discovery boundaries.
- Source plan:
  `docs/superpowers/plans/2026-07-09-directional-block-privacy.md`

### Mobile Lane

- Pointer: `docs/plans/mobile/NOW.md`
- State: active for regression coverage proving hidden profiles use the same
  generic unavailable state as missing profiles.
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

Complete the directional privacy fix without activating deferred unfollow,
unblock, or release-candidate device QA work.

## Repair Conditions

Repair this dashboard when a lane pointer or status stops matching its lane
`NOW.md`, another lane is reprioritized, or shared ownership policy changes.
