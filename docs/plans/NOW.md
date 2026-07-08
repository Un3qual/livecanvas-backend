# Current Execution

Last reviewed: 2026-07-03
Status: mobile post media attachment batch selected; backend issues may be promoted as needed; release-candidate QA deferred

## Purpose

This file is the coordinator dashboard only. It names the active lanes and points
to the lane `NOW.md` files. The lane `NOW.md` owns executable current-batch
details.

## Lane Pointers

### Backend Lane

- Pointer: `docs/plans/backend/NOW.md`
- State: issue-driven; live media runtime foundation is complete and no
  standalone backend batch is selected
- Scope: backend code and backend planning docs
- Completed source plan:
  `docs/plans/archive/completed/backend/2026-06-04-live-media-runtime-foundation.md`

### Mobile Lane

- Pointer: `docs/plans/mobile/NOW.md`
- State: active; mobile post media attachment batch selected
- Scope: `mobile/` and `docs/plans/mobile/**`
- Active source plan:
  `docs/plans/mobile/2026-07-03-mobile-post-media-attachments.md`
- Latest completed source plan:
  `docs/plans/mobile/2026-07-01-mobile-post-composer.md`
- Latest completed feed/content plan:
  `docs/plans/archive/completed/mobile/2026-06-30-mobile-feed-content-discovery.md`

## Execution Rule

For ordinary work, open the relevant lane pointer and execute from that file.
Use `docs/plans/INDEX.md` only if a lane pointer is stale, blocked, empty, or
explicitly asks for registry/backlog lookup.

## Cross-Lane Policy

Work through backend and frontend issues as needed for the selected product
batch. Do not defer a verified backend contract, resolver, runtime, or data
issue solely because the current visible surface is mobile/frontend. Promote
that backend work into the backend lane, keep the write scope explicit, and
verify both sides that are affected.

## Week Plan

- Plan: `docs/plans/2026-07-01-cross-lane-product-week.md`
- Horizon: 2026-07-01 through 2026-07-07
- Focus: execute the selected mobile post media attachment batch after the
  completed text composer, verify backend issues only when reproduced by active
  product work, and keep release-candidate manual QA deferred.

## Shared File Policy

Only a coordinator-assigned task edits `docs/plans/NOW.md`,
`docs/plans/INDEX.md`, `AGENTS.md`, `ARCHITECTURE.md`, or shared contract/schema
docs. Lane workers update their lane `NOW.md`, source detailed plan, and lane
track docs.

## Next Coordinator Decision

Do not reactivate release-candidate QA yet. Execute the mobile post media
attachment batch from `docs/plans/mobile/NOW.md`. Promote backend fixes only
when active product work proves they are needed, before any release-candidate
device QA work resumes.

## Repair Conditions

Repair this dashboard when:

- a lane pointer is wrong
- lane status no longer matches the lane `NOW.md`
- another lane is explicitly reprioritized
- shared ownership policy changes
