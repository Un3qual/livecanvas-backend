# Backend Lane Execution

Last reviewed: 2026-03-27
Status: active for execution

## Lane Scope

- Own backend code and backend planning docs only.
- Do not edit `mobile/`, `docs/plans/mobile/**`, or coordinator-owned shared docs such as `docs/plans/NOW.md` and `docs/plans/INDEX.md`.

## Current Batch

- Track: `release_observability_metrics_and_correlation`
- Source: `docs/plans/release/2026-03-27-observability-metrics-and-correlation.md`
- Batch: `Task 2: Add a gated metrics scrape surface and runtime configuration`
- Why now: Task 1's metric catalog now exists with focused coverage, so the next unblocked release gap is exposing that shared catalog through an explicitly gated scrape surface operators can enable during rollout.

## Do This Now

- Re-open `docs/plans/release/2026-03-27-observability-metrics-and-correlation.md` and execute `Task 2` exactly as written.
- Verify the immediate prerequisites still hold before editing: `mix.exs` still lacks a Prometheus-compatible telemetry exporter dependency, and `lib/live_canvas_web/router.ex` still exposes no gated `/metrics` or `/ops/metrics` scrape route.
- Keep the work inside backend code and backend planning/release docs only.
- Report any required coordinator updates to `docs/plans/INDEX.md` and `docs/plans/NOW.md` instead of editing those shared files directly.

## Verification Scope

```bash
mix test test/live_canvas_web/controllers/metrics_endpoint_test.exs
```

## Next Up

- `docs/plans/release/2026-03-27-observability-metrics-and-correlation.md` -> `Task 3: Add HTTP/GraphQL/channel correlation context plumbing`

## Repair Conditions

Repair this lane pointer from `docs/plans/INDEX.md` and the relevant source plan when:

- the current batch is already complete
- the current batch is blocked
- another backend track is explicitly reprioritized ahead of it
- the selected plan no longer matches the codebase
