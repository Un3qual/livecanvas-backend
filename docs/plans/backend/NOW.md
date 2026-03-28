# Backend Lane Execution

Last reviewed: 2026-03-27
Status: active for execution

## Lane Scope

- Own backend code and backend planning docs only.
- Do not edit `mobile/`, `docs/plans/mobile/**`, or coordinator-owned shared docs such as `docs/plans/NOW.md` and `docs/plans/INDEX.md`.

## Current Batch

- Track: `release_observability_metrics_and_correlation`
- Source: `docs/plans/release/2026-03-27-observability-metrics-and-correlation.md`
- Batch: `Task 4: Publish the observability contract, refresh roadmap tracking, and run final verification`
- Why now: Task 3 now wires stable request, GraphQL, and channel correlation metadata, so the remaining unblocked work is documenting the contract, syncing the release roadmap evidence, and running the final release-ready verification set.

## Do This Now

- Re-open `docs/plans/release/2026-03-27-observability-metrics-and-correlation.md` and execute `Task 4` exactly as written.
- Verify the immediate prerequisites still hold before editing: `docs/release/observability-metrics.md` does not exist yet, the rollout/deployment runbooks still reference generic dashboard/SLO checks, and the release-readiness roadmap still lacks Task 4 completion evidence for this observability track.
- Keep the work inside backend code and backend planning/release docs only.
- Report any required coordinator updates to `docs/plans/INDEX.md` and `docs/plans/NOW.md` instead of editing those shared files directly.

## Verification Scope

```bash
mix test test/live_canvas_web/telemetry_test.exs test/live_canvas_web/controllers/metrics_endpoint_test.exs test/live_canvas_web/plugs/observability_context_test.exs test/live_canvas_gql/context_test.exs test/live_canvas_web/channels/live_session_channel_test.exs
mix compile
mix typecheck
mix release.gates --dry-run
```

## Next Up

- Report the backend lane status change to the coordinator so `docs/plans/NOW.md` can advance from the Task 3 execution summary to the Task 4 summary for the same release track.

## Repair Conditions

Repair this lane pointer from `docs/plans/INDEX.md` and the relevant source plan when:

- the current batch is already complete
- the current batch is blocked
- another backend track is explicitly reprioritized ahead of it
- the selected plan no longer matches the codebase
