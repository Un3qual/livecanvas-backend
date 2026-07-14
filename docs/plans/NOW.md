# Current Execution

Last reviewed: 2026-07-14
Status: local release-candidate gates pass; operator and device QA pending

## Purpose

This is the coordinator dashboard. Lane `NOW.md` files own executable details.

## Approved Sequence

- Sequence design:
  `docs/superpowers/specs/2026-07-09-next-five-product-batches-design.md`
- Batch 2 design:
  `docs/superpowers/specs/2026-07-09-profile-content-surfaces-design.md`
- Latest completed implementation:
  `docs/superpowers/plans/2026-07-11-end-to-end-contact-invitations.md`
- Batch 3 implementation plan:
  `docs/superpowers/plans/2026-07-11-media-post-publishing.md`
- Batch 4 implementation plan:
  `docs/superpowers/plans/2026-07-11-live-chat-message-controls.md`
- Batch 5 implementation plan:
  `docs/superpowers/plans/2026-07-11-end-to-end-contact-invitations.md`
- Batch 1 reversible social controls is complete in stacked base PR #115.
- All five approved product batches are complete.
- Release-candidate device QA resumes from
  `docs/plans/mobile/2026-06-25-release-candidate-checklist.md`.

## Lane Pointers

### Backend Lane

- Pointer: `docs/plans/backend/NOW.md`
- State: Batch 5 backend Tasks 1-3 complete; stand by only for defects found by
  release-candidate QA.
- Verification: neutral invite delivery, trusted public-origin configuration,
  endpoint-neutral public landing, focused GraphQL behavior, assets, types, and
  the 1,010-test backend suite pass.

### Mobile Lane

- Pointer: `docs/plans/mobile/NOW.md`
- State: Batch 5 mobile Tasks 4-5 and release-candidate local entry gates are
  complete; operator-confirmed environment, account, build, and device QA is
  pending.
- Track: `docs/plans/mobile/TRACK.md`
- Verification: configured-origin invite routing and the full mobile quality
  gate pass with 552 Vitest and 165 Jest tests; typechecks, lint, frozen pnpm
  install, and patch hygiene pass. Relay inputs were unchanged by the
  integration fixes.

## Execution Rule

Execute the resumed release-candidate gate from
`docs/plans/mobile/2026-06-25-release-candidate-checklist.md`. Do not run remote
or authenticated EAS commands unless the user explicitly requests them.

## Cross-Lane Policy

Do not defer a reproduced backend contract, resolver, runtime, or data issue
solely because the visible surface is mobile. Promote it into the backend lane,
state the write scope, and verify both affected sides.

## Next Coordinator Action

Have the release operator confirm EAS project linkage, the target
endpoint/public-origin values, preview artifact, host/viewer identities,
unmatched recipient inbox, and physical devices, then run the
release-candidate checklist's manual QA.

## Repair Conditions

Repair this dashboard when a lane pointer or status stops matching its lane
`NOW.md`, another lane is reprioritized, or shared ownership policy changes.
