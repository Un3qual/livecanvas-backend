# Plans Directory Guide

Use this directory for active execution docs and detailed implementation plans.

## Start Here

- `docs/plans/NOW.md`: the single authoritative pointer for the next batch of work.
- `docs/plans/INDEX.md`: active tracks, queued work, and paused/deferred slices.
- `docs/plans/<track>/TRACK.md`: ordering and dependencies inside a multi-plan track.
- Detailed plan files: open only the plan for the selected batch unless `NOW.md` is stale, blocked, or complete.

## Execution Priority

- Until further notice, product feature completeness is the primary goal.
- Prefer product-facing backend work over observability, automation, and other operational follow-up work unless the user explicitly reprioritizes or the work is required to unblock product delivery.

## Active Tracks

- Chat product surface: `docs/plans/chat/TRACK.md`
- Release roadmap and planning-hole tracker: `docs/plans/2026-03-03-backend-release-readiness-roadmap.md`

## Paused Or Deferred

- Compliance hard-delete enablement remains paused. Do not resume it until the pause is explicitly lifted.

## Execution Rules

- Read `docs/plans/NOW.md` first for ordinary execution turns.
- Use `docs/plans/INDEX.md` only when `NOW.md` is stale, blocked, or empty.
- If the selected work belongs to a multi-plan track, read that track's `TRACK.md` before opening detailed plan files.
- Avoid scanning unrelated active plans or archived work during normal execution.
- Move checklist-complete plans to `docs/plans/archive/completed/`.

## Starting A New Feature

1. Write or update the approved design doc in the most specific folder that fits the work, such as `docs/plans/chat/` or `docs/plans/graphql/`.
2. Write the execution plan file with task-level checklists and verification commands.
3. If the work belongs to an existing track, update that track's `TRACK.md`; otherwise add a new track entry to `docs/plans/INDEX.md`.
4. Point `docs/plans/NOW.md` at the first executable batch with the exact plan file, task, and verification scope.
5. Start execution from the short prompt below instead of asking the agent to rediscover priority from the full docs tree.

## Starter Prompt

```text
Open /Users/admin/.codex/worktrees/e21e/backend/docs/plans/NOW.md and execute the Current Batch.

Follow AGENTS.md for execution policy.
Verify only the selected batch and its immediate prerequisites in code before editing; do not rescan unrelated plans unless NOW.md is stale, blocked, or complete.
Update the relevant checklist and NOW.md as you go.
If the current batch finishes, advance NOW.md to the next unblocked batch.
If there is no current batch, consult docs/plans/INDEX.md and create the next implementation plan from ARCHITECTURE.md.
```
