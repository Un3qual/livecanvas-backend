# Plans Directory Guide

Use this directory for active execution docs and detailed implementation plans.

## Start Here

- `docs/plans/NOW.md`: coordinator dashboard for the current execution lanes.
- `docs/plans/backend/NOW.md`: executable pointer for the next backend batch.
- `docs/plans/mobile/NOW.md`: executable pointer for the next mobile batch.
- `docs/plans/INDEX.md`: lane status, queued work, and paused/deferred slices.
- `docs/plans/<track>/TRACK.md`: ordering and dependencies inside a multi-plan track.
- Detailed plan files: open only the plan for the selected lane batch unless that lane `NOW.md` is stale, blocked, or complete.

## Execution Priority

- Until further notice, product feature completeness is the primary goal.
- Prefer product-facing backend work over observability, automation, and other operational follow-up work unless the user explicitly reprioritizes or the work is required to unblock product delivery.

## Active Lanes

- Backend lane: `docs/plans/backend/NOW.md` currently points at `docs/plans/feed/2026-03-19-user-profile-content-and-live-entry.md` -> `Task 3`.
- Mobile lane: `docs/plans/mobile/NOW.md` currently points at the first post-bootstrap planning batch.
- Release roadmap and planning-hole tracker: `docs/plans/2026-03-03-backend-release-readiness-roadmap.md` remains reference-only until a lane needs it.

## Recently Completed

- Live replay and recording track: archived under `docs/plans/archive/completed/live/`

## Paused Or Deferred

- Compliance hard-delete enablement remains paused. Do not resume it until the pause is explicitly lifted.

## Execution Rules

- Read `docs/plans/NOW.md` first to identify the active lanes, then open the relevant lane-specific `NOW.md` for ordinary execution turns.
- Use `docs/plans/INDEX.md` only when a lane `NOW.md` is stale, blocked, or empty, or when the coordinator dashboard needs repair.
- If the selected work belongs to a multi-plan track, read that track's `TRACK.md` before opening detailed plan files.
- Avoid scanning unrelated active plans or archived work during normal execution.
- Move checklist-complete plans to `docs/plans/archive/completed/<track>/`.

## Starting A New Feature

1. Write or update the approved design doc in the most specific folder that fits the work, such as `docs/plans/chat/` or `docs/plans/graphql/`.
2. Write the execution plan file with task-level checklists and verification commands.
3. If the work belongs to an existing track, update that track's `TRACK.md`; otherwise add a new track entry to `docs/plans/INDEX.md`.
4. Point the relevant lane `NOW.md` at the first executable batch with the exact plan file, task, and verification scope.
5. Refresh `docs/plans/NOW.md` and `docs/plans/INDEX.md` only when the lane lineup or shared execution summary changes.
6. Start execution from the short prompt below instead of asking the agent to rediscover priority from the full docs tree.

## Starter Prompts

### Single Lane

```text
Open docs/plans/NOW.md, choose the relevant lane, then execute the Current Batch from that lane's NOW file.

Follow AGENTS.md for execution policy.
Verify only the selected batch and its immediate prerequisites in code before editing; do not rescan unrelated plans unless the lane NOW is stale, blocked, or complete.
Update the relevant checklist and lane NOW as you go.
If the current batch finishes, advance the lane NOW to the next unblocked batch and report any shared dashboard/index updates needed.
If there is no current batch, consult docs/plans/INDEX.md and the relevant TRACK.md, then create the next implementation plan for that lane.
```

### Parallel Backend And Mobile

```text
Use docs/plans/NOW.md as the coordinator dashboard and run in parallel-lane mode.

Create two isolated git worktrees and branches: one for the backend lane and one for the mobile lane.

Backend lane:
- Start from docs/plans/backend/NOW.md.
- Own backend code and backend planning docs only.
- Do not edit mobile/ or docs/plans/mobile/**.

Mobile lane:
- Start from docs/plans/mobile/NOW.md.
- Own mobile/ and docs/plans/mobile/** only.
- Do not edit backend Elixir/GraphQL code.

Shared-file policy:
- Only the coordinator edits docs/plans/NOW.md, docs/plans/INDEX.md, AGENTS.md, ARCHITECTURE.md, and shared contract/schema docs unless I explicitly assign a shared-contract task.
- Tell both agents they are not alone in the codebase, must not revert each other's work, and must stay inside their write scope.
- If either lane needs a shared API/schema/contract change, stop that lane and report the dependency instead of editing across boundaries.

Return separate verification summaries and separate commits/PRs.
```
