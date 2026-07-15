# Current Execution

Last reviewed: 2026-07-15
Status: release-candidate operator/device QA active

## Purpose

This is the coordinator dashboard. Lane `NOW.md` files own executable details.

## Approved Sequence

- Completed design:
  `docs/superpowers/specs/2026-07-15-basic-profile-identity-design.md`
- Completed implementation:
  `docs/superpowers/plans/2026-07-15-basic-profile-identity.md`
- Completed batch: persisted display name and unique handle, authorized Relay
  fields, shared mobile presentation, and viewer-scoped editing.
- Completed design:
  `docs/superpowers/specs/2026-07-15-native-contact-import-design.md`
- Completed implementation:
  `docs/superpowers/plans/2026-07-15-native-contact-import.md`
- Completed batch: viewer-scoped atomic contact chunks, minimal native
  address-book access, and generation-safe mobile import into existing
  discovery results.
- Completed design:
  `docs/superpowers/specs/2026-07-15-mobile-magic-link-auth-design.md`
- Completed implementation:
  `docs/superpowers/plans/2026-07-15-mobile-magic-link-auth.md`
- Completed batch: configured fragment-only magic-link delivery, strict mobile
  handoff, request UI, and GraphQL redemption into the existing auth session.
- Completed milestones: all five release-depth batches are implemented and the
  full local closure matrix passes.
- Completed batch: post attribution and author-profile navigation in PR #125.
- Completed design:
  `docs/superpowers/specs/2026-07-14-mobile-post-attribution-navigation-design.md`
- Completed plan:
  `docs/superpowers/plans/2026-07-14-mobile-post-attribution-navigation.md`
- Sequence design:
  `docs/superpowers/specs/2026-07-09-next-five-product-batches-design.md`
- Batch 2 design:
  `docs/superpowers/specs/2026-07-09-profile-content-surfaces-design.md`
- Previous completed implementation:
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
- State: identity persistence and GraphQL contract complete; support
  operator/device QA only for reproduced backend issues.

### Mobile Lane

- Pointer: `docs/plans/mobile/NOW.md`
- State: basic profile identity complete; release-candidate operator/device QA
  is active.
- Track: `docs/plans/mobile/TRACK.md`
- Verification: focused backend/mobile identity suites, backend format and
  typecheck/full tests, Relay generation, mobile quality, Nix, and patch hygiene.

## Execution Rule

Execute the operator/device checklist from the mobile lane pointer. Do not mark
operator or physical-device QA complete from local evidence.

## Cross-Lane Policy

Do not defer a reproduced backend contract, resolver, runtime, or data issue
solely because the visible surface is mobile. Promote it into the backend lane,
state the write scope, and verify both affected sides.

## Next Coordinator Action

Confirm the target-environment inventory in the release-candidate checklist,
then run the manual host/viewer device checks.

## Repair Conditions

Repair this dashboard when a lane pointer or status stops matching its lane
`NOW.md`, another lane is reprioritized, or shared ownership policy changes.
