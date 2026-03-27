# Backend Lane Execution

Last reviewed: 2026-03-27
Status: active for execution

## Lane Scope

- Own backend code and backend planning docs only.
- Do not edit `mobile/`, `docs/plans/mobile/**`, or coordinator-owned shared docs such as `docs/plans/NOW.md` and `docs/plans/INDEX.md`.

## Current Batch

- Track: `release_observability_metrics_and_correlation`
- Source: `docs/plans/release/2026-03-27-observability-metrics-and-correlation.md`
- Batch: `Task 1: Add app-specific Telemetry metric definitions and focused tests`
- Why now: The roadmap's explicit planning holes are closed or paused, release rollout docs already exist, and the clearest remaining unpaused release gap is that emitted live/auth Telemetry is still not surfaced as exportable metrics with concrete operational coverage.

## Do This Now

- Re-open `docs/plans/release/2026-03-27-observability-metrics-and-correlation.md` and execute `Task 1` exactly as written.
- Verify the immediate prerequisite still holds before editing: `LCWeb.Telemetry.metrics/0` has no app-specific `live_canvas` metrics yet.
- Keep the work inside backend code and backend planning/release docs only.
- Report any required coordinator updates to `docs/plans/INDEX.md` and `docs/plans/NOW.md` instead of editing those shared files directly.

## Verification Scope

```bash
mix test test/live_canvas_web/telemetry_test.exs
```

## Next Up

- `docs/plans/release/2026-03-27-observability-metrics-and-correlation.md` -> `Task 2: Add a gated metrics scrape surface and runtime configuration`

## Repair Conditions

Repair this lane pointer from `docs/plans/INDEX.md` and the relevant source plan when:

- the current batch is already complete
- the current batch is blocked
- another backend track is explicitly reprioritized ahead of it
- the selected plan no longer matches the codebase
