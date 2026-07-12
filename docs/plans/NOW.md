# Current Execution

Last reviewed: 2026-07-11
Status: all five product batches complete; release-candidate device QA active

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
- Verification: Batch 5 focused Accounts, public-route, GraphQL, type, asset,
  and full backend gates pass.

### Mobile Lane

- Pointer: `docs/plans/mobile/NOW.md`
- State: Batch 5 mobile Tasks 4-5 complete; release-candidate QA is active.
- Track: `docs/plans/mobile/TRACK.md`
- Verification: focused invite suites and the full mobile quality gate pass;
  Relay generation, typechecks, lint, and patch hygiene pass.

## Execution Rule

Execute the resumed release-candidate gate from
`docs/plans/mobile/2026-06-25-release-candidate-checklist.md`. Do not run remote
or authenticated EAS commands unless the user explicitly requests them.

## Cross-Lane Policy

Do not defer a reproduced backend contract, resolver, runtime, or data issue
solely because the visible surface is mobile. Promote it into the backend lane,
state the write scope, and verify both affected sides.

## Next Coordinator Action

Run the release-candidate checklist's local entry gates, then inventory the
remaining account, preview-build, and physical-device prerequisites for manual
QA.

## Repair Conditions

Repair this dashboard when a lane pointer or status stops matching its lane
`NOW.md`, another lane is reprioritized, or shared ownership policy changes.
