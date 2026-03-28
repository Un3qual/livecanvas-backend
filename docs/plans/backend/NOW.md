# Backend Lane Execution

Last reviewed: 2026-03-27
Status: active for planning

## Lane Scope

- Own backend code and backend planning docs only.
- Do not edit `mobile/`, `docs/plans/mobile/**`, or coordinator-owned shared docs such as `docs/plans/NOW.md` and `docs/plans/INDEX.md`.

## Current Batch

- Track: `release_roadmap_and_planning_holes`
- Source: `docs/plans/2026-03-03-backend-release-readiness-roadmap.md`
- Batch: `Create the next detailed backend implementation plan`
- Why now: The observability metrics/correlation track is complete, so the backend lane returns to roadmap-driven planning to select and scope the next unblocked backend slice.

## Do This Now

- Review `docs/plans/2026-03-03-backend-release-readiness-roadmap.md` and the active backlog notes in `docs/plans/INDEX.md`.
- Verify the highest-priority unblocked backend gap directly in code/docs before writing the next plan.
- Create the next detailed backend implementation plan in the most specific backend docs folder that fits the work.
- Point this lane file at the first executable batch from that new plan once the plan is ready.
- Report any required coordinator updates to `docs/plans/INDEX.md` and `docs/plans/NOW.md` instead of editing those shared files directly.

## Verification Scope

- Verify the candidate gap against the codebase before drafting the next plan; no fixed command set applies until the new batch is selected.

## Next Up

- Once the next backend implementation plan is written, update this file to the first executable batch from that plan and tell the coordinator only if the shared dashboard/index no longer match.

## Repair Conditions

Repair this lane pointer from `docs/plans/INDEX.md` and the relevant source plan when:

- the current batch is already complete
- the current batch is blocked
- another backend track is explicitly reprioritized ahead of it
- the selected plan no longer matches the codebase
