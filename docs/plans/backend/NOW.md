# Backend Lane Execution

Last reviewed: 2026-03-27
Status: active for execution

## Lane Scope

- Own backend code and backend planning docs only.
- Do not edit `mobile/`, `docs/plans/mobile/**`, or coordinator-owned shared docs such as `docs/plans/NOW.md` and `docs/plans/INDEX.md`.

## Current Batch

- Track: `release_observability_metrics_and_correlation`
- Source: `docs/plans/release/2026-03-27-observability-metrics-and-correlation.md`
- Batch: `Task 3: Add HTTP/GraphQL/channel correlation context plumbing`
- Why now: Task 2 now exposes the release metrics catalog behind an explicitly gated scrape path, so the next unblocked observability gap is propagating stable request and channel correlation metadata across HTTP, GraphQL, and socket flows.

## Do This Now

- Re-open `docs/plans/release/2026-03-27-observability-metrics-and-correlation.md` and execute `Task 3` exactly as written.
- Verify the immediate prerequisites still hold before editing: `config/config.exs` still limits Logger metadata to `[:request_id]`, and the codebase still has no `observability_context` plug or `trace_id` correlation plumbing in HTTP, GraphQL, or channel paths.
- Keep the work inside backend code and backend planning/release docs only.
- Report any required coordinator updates to `docs/plans/INDEX.md` and `docs/plans/NOW.md` instead of editing those shared files directly.

## Verification Scope

```bash
mix test test/live_canvas_web/plugs/observability_context_test.exs test/live_canvas_gql/context_test.exs test/live_canvas_web/channels/live_session_channel_test.exs
```

## Next Up

- `docs/plans/release/2026-03-27-observability-metrics-and-correlation.md` -> `Task 4: Publish the observability contract, refresh roadmap tracking, and run final verification`

## Repair Conditions

Repair this lane pointer from `docs/plans/INDEX.md` and the relevant source plan when:

- the current batch is already complete
- the current batch is blocked
- another backend track is explicitly reprioritized ahead of it
- the selected plan no longer matches the codebase
