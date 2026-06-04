# Plans Directory Guide

Use this directory for active execution pointers, lane tracks, and detailed
implementation plans. The goal is fast handoff: a worker should know the next
action after opening the dashboard and one lane `NOW.md`.

## Authority Model

- `docs/plans/<lane>/NOW.md` is the single executable source of truth for that
  lane's current batch.
- `docs/plans/NOW.md` is a coordinator dashboard. It lists lane pointers and
  high-level state only.
- `docs/plans/INDEX.md` is a registry/backlog. It does not own current-batch
  status.
- `docs/plans/<track>/TRACK.md` records plan order and dependencies inside a
  track. It does not own task checklists.
- Detailed plan files own task checklists, implementation notes, and verification
  evidence.
- Archived plans are historical context. Do not start from them unless a lane
  `NOW.md` or active plan explicitly sends you there.

If these files disagree, execute from the lane `NOW.md` and repair stale pointer
text only when the current assignment includes docs/coordination repair.

## Fast Start

1. Open `docs/plans/NOW.md` to pick the lane.
2. Open that lane's `NOW.md`.
3. Execute the current batch from the lane `NOW.md`.
4. Open the source detailed plan only for the selected task.
5. Use `docs/plans/INDEX.md` only when the lane `NOW.md` is stale, blocked, or
   empty.

Do not scan unrelated active plans, archived work, or broad roadmap docs during
normal execution.

## Lane NOW Format

Keep lane `NOW.md` files short enough to read in one screen. Each lane `NOW.md`
should include:

- lane status
- current batch or explicit `none`
- source plan
- owned write scope
- done condition
- minimum verification
- next action after the batch

Do not store long completed-batch evidence, historical stage matrices, or full
task scripts in lane `NOW.md`. Put that material in the detailed plan or archive.

## Detailed Plan Format

Detailed plans should be concise execution aids, not scripts that replace
engineering judgment.

Use these sections:

1. `Executor Brief`: current goal, source lane, task order, boundaries.
2. `Context`: only the facts needed for this plan.
3. `Tasks`: files, acceptance criteria, and focused verification per task.
4. `Final Verification`: the commands required before handoff.
5. `Handoff`: what remains blocked, deferred, or next.

Prefer concrete file paths, command names, and acceptance criteria. Include exact
code snippets only for non-obvious contracts, tricky tests, or API shapes. If a
plan grows past roughly 300 lines, split it or compress repeated code examples.

## Progress And Commits

- Update checkboxes in the same pass as related implementation whenever
  possible.
- Do not make standalone checkbox-only or docs-only progress commits during
  ordinary implementation.
- Docs-only commits are fine when the user explicitly asks for planning,
  handoff repair, lane activation/closure, or documentation redesign.
- Commit at completed task sections, user-visible behavior changes, or required
  verification checkpoints.

## Starting New Work

When a lane has no current batch:

1. Read the lane `NOW.md`.
2. Read the relevant `TRACK.md`.
3. Consult `docs/plans/INDEX.md` only for registry/backlog context.
4. Use `ARCHITECTURE.md` only when product priority or architecture direction is
   unclear.
5. Create or promote one executable detailed plan.
6. Point only the lane `NOW.md` at the first batch.
7. Update shared dashboard/index docs only if the lane lineup or registry changes.

## Starter Prompt

```text
Open docs/plans/NOW.md, choose the relevant lane, then execute the current batch
from that lane's NOW file.

Follow AGENTS.md.
Verify only the selected batch and immediate prerequisites before editing.
Do not rescan unrelated plans unless the lane NOW is stale, blocked, or empty.
Update the source plan checklist and lane NOW as work proceeds.
If the batch finishes, advance the lane NOW to the next batch or mark the lane
idle and record the next handoff.
```

## Parallel Lane Prompt

```text
Use docs/plans/NOW.md only as the coordinator dashboard.

Create one isolated worktree and branch per lane.
Each lane starts from its own docs/plans/<lane>/NOW.md and stays inside that
lane's write scope.

Shared files such as docs/plans/NOW.md, docs/plans/INDEX.md, AGENTS.md,
ARCHITECTURE.md, and shared contracts are coordinator-owned unless explicitly
assigned.

Return separate verification summaries and separate commits or PRs.
```
