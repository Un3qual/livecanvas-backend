# Backend Lane Execution

Last reviewed: 2026-03-22
Status: active for execution

## Lane Scope

- Own backend code and backend planning docs only.
- Do not edit `mobile/`, `docs/plans/mobile/**`, or coordinator-owned shared docs such as `docs/plans/NOW.md` and `docs/plans/INDEX.md`.

## Current Batch

- Track: `development_seed_data`
- Source: `docs/plans/2026-03-22-development-seed-data.md`
- Batch: `Task 1: Add a tested, idempotent development seed foundation`
- Why now: the development seed-data slice is the next unimplemented backend product plan, and its first batch still needs the seed module, seed script wiring, and test coverage.

## Do This Now

- Review `docs/plans/2026-03-22-development-seed-data.md` and any directly related backend planning docs needed to execute Task 1.
- Implement `Task 1: Add a tested, idempotent development seed foundation` from that plan.
- Keep the work inside backend code and backend planning docs only.
- Report any required coordinator updates to `docs/plans/INDEX.md` and `docs/plans/NOW.md` in the completion summary instead of editing those shared files directly.

## Verification Scope

```bash
test -f docs/plans/2026-03-22-development-seed-data.md
```

## Next Up

- Once Task 1 is complete, advance this lane to Task 2 in `docs/plans/2026-03-22-development-seed-data.md`.

## Repair Conditions

Repair this lane pointer from `docs/plans/INDEX.md` and the relevant `TRACK.md` when:

- the current batch is already complete
- the current batch is blocked
- another backend track is explicitly reprioritized ahead of it
- the selected plan no longer matches the codebase
