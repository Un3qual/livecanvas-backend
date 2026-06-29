# Release Observability Metrics And Correlation Implementation Plan

> **Archive status:** Completed or historical plan retained for reference.
> Active execution starts from `docs/plans/NOW.md` and lane-specific `NOW.md` files.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the remaining unpaused release-roadmap observability gap by turning existing live/auth Telemetry events into exportable metrics, adding a gated scrape surface, and wiring request/channel correlation metadata that rollout runbooks can consume directly.

**Architecture:** Reuse the existing Telemetry events already emitted from `LC.Live`, `LCWeb.LiveSessionChannel`, and `LC.Accounts` rather than adding new domain-facing APIs. Extend `LCWeb.Telemetry.metrics/0` with app-specific counters and latency summaries, expose them through a disabled-by-default Prometheus-compatible scrape surface owned by `LCWeb`, and add lightweight correlation plumbing so HTTP, GraphQL, and channel paths share `request_id`, `trace_id`, viewer, and live-session metadata without leaking secrets.

**Tech Stack:** Elixir 1.15, Phoenix, Telemetry, `telemetry_metrics_prometheus_core`, Logger, ExUnit, Dialyzer

---

## Candidate Status Verification (2026-03-27)

Verified directly in the current codebase before drafting this plan:

1. **App-specific Telemetry events are not surfaced as metrics.**
   - Evidence: `lib/live_canvas_web/telemetry.ex` defines only Phoenix, Ecto, and VM metrics; it contains no `live_canvas` metric entries even though runtime event emitters now exist in `lib/live_canvas/live.ex`, `lib/live_canvas_web/channels/live_session_channel.ex`, and `lib/live_canvas/accounts.ex`.
2. **The repo has no metrics exporter or scrape surface.**
   - Evidence: `mix.exs` includes `:telemetry_metrics` and `:telemetry_poller`, but no Prometheus/OpenTelemetry exporter dependency, and `lib/live_canvas_web/router.ex` exposes no `/metrics` or `/ops/metrics` endpoint.
3. **Correlation metadata stops at `request_id`.**
   - Evidence: `config/config.exs` configures Logger metadata as `[:request_id]`, and a repo search found no `Logger.metadata/1` plumbing for viewer, live-session, or trace identifiers.
4. **Release runbooks reference dashboards/alerts without a repo-owned metric catalog.**
   - Evidence: `docs/release/deployment-gates.md` and `docs/release/staged-rollout.md` require dashboard/SLO checks, but `docs/release/` contains no concrete observability metrics contract or scrape configuration guide.

## Scope And Constraints

- Keep the slice inside backend code and backend planning/release docs only.
- Do not resume paused compliance hard-delete work.
- Keep Telemetry metadata bounded to scalar IDs, enums, and normalized reason codes; never tag metrics with raw tokens, message bodies, emails, or other secrets.
- Keep the metrics surface disabled by default and explicitly gated when enabled so rollout tooling does not become a public unauthenticated endpoint.
- Treat full third-party APM/vendor selection as out of scope; this slice should establish an exporter-friendly baseline the current release runbooks can rely on.

## Progress

- [x] Task 1: Add app-specific Telemetry metric definitions and focused tests
- [x] Task 2: Add a gated metrics scrape surface and runtime configuration
- [x] Task 3: Add HTTP/GraphQL/channel correlation context plumbing
- [x] Task 4: Publish the observability contract, refresh roadmap tracking, and run final verification

### Task 1: Add App-Specific Telemetry Metric Definitions And Focused Tests

**Files:**
- Modify: `lib/live_canvas_web/telemetry.ex`
- Create: `test/live_canvas_web/telemetry_test.exs`
- Modify: `docs/plans/release/2026-03-27-observability-metrics-and-correlation.md`

**Task 1 Step Progress:**
- [x] Step 1: Add failing tests asserting `LCWeb.Telemetry.metrics/0` exposes counters and summaries for live session lifecycle, live channel join/chat outcomes, and auth lifecycle outcomes with bounded tag sets
- [x] Step 2: Run focused Telemetry tests to verify RED
- [x] Step 3: Implement the app-specific metric catalog in `LCWeb.Telemetry.metrics/0`
- [x] Step 4: Run focused Telemetry tests to verify GREEN
- [x] Step 5: Run `mix compile`, update checklist progress, and commit the metric-catalog milestone

**Task 1 behavior targets:**

- The metrics catalog includes release-useful app metrics for:
  - `[:live_canvas, :live, :session, :start|:join|:end]`
  - `[:live_canvas, :live, :channel, :join|:chat_send]`
  - `[:live_canvas, :accounts, :auth, <event_type>]`
- Metric tags stay low-cardinality and operationally safe (`result`, `reason`, `event_type`, `audit_persisted`).
- Existing Phoenix/Ecto/VM metrics remain intact.

**Suggested verification command:**

```bash
mix test test/live_canvas_web/telemetry_test.exs
```

Expected: RED first, then GREEN once the metric catalog exists.

### Task 2: Add A Gated Metrics Scrape Surface And Runtime Configuration

**Files:**
- Modify: `mix.exs`
- Modify: `lib/live_canvas_app.ex`
- Create: `lib/live_canvas_web/plugs/metrics_auth.ex`
- Modify: `lib/live_canvas_web/router.ex`
- Modify: `config/config.exs`
- Modify: `config/runtime.exs`
- Create: `test/live_canvas_web/controllers/metrics_endpoint_test.exs`
- Modify: `docs/plans/release/2026-03-27-observability-metrics-and-correlation.md`

**Task 2 Step Progress:**
- [x] Step 1: Add the exporter dependency/config scaffolding plus failing endpoint tests covering disabled-by-default behavior and enabled authorized scrapes
- [x] Step 2: Run `mix deps.get` and the focused endpoint tests to verify RED
- [x] Step 3: Implement a disabled-by-default, token-gated scrape path that exports the `LCWeb.Telemetry.metrics/0` catalog without relying on `dev_routes`
- [x] Step 4: Run focused endpoint tests to verify GREEN
- [x] Step 5: Run `mix compile`, update checklist progress, and commit the scrape-surface milestone

**Task 2 behavior targets:**

- Metrics export can be enabled explicitly via config/runtime settings and remains off by default.
- Scrapes require explicit authorization when the endpoint is enabled.
- The route returns Prometheus text output backed by the shared Telemetry metric catalog.
- The release-ready metrics surface lives outside the `/dev` dashboard gate so operators can use it in non-dev environments without exposing the full dev toolbox.

**Suggested verification command:**

```bash
mix test test/live_canvas_web/controllers/metrics_endpoint_test.exs
```

Expected: RED first, then GREEN after the route/auth/export wiring is in place.

### Task 3: Add HTTP/GraphQL/Channel Correlation Context Plumbing

**Files:**
- Create: `lib/live_canvas_web/plugs/observability_context.ex`
- Modify: `lib/live_canvas_web/endpoint.ex`
- Modify: `lib/live_canvas_gql/context.ex`
- Modify: `lib/live_canvas_web/channels/user_socket.ex`
- Modify: `lib/live_canvas_web/channels/live_session_channel.ex`
- Create: `test/live_canvas_web/plugs/observability_context_test.exs`
- Create: `test/live_canvas_gql/context_test.exs`
- Modify: `test/live_canvas_web/channels/live_session_channel_test.exs`
- Modify: `docs/plans/release/2026-03-27-observability-metrics-and-correlation.md`

**Task 3 Step Progress:**
- [x] Step 1: Add failing plug/context/channel tests proving requests and socket joins carry stable `request_id`/`trace_id` correlation data without leaking auth secrets
- [x] Step 2: Run focused observability-context tests to verify RED
- [x] Step 3: Implement correlation-ID generation/normalization, Logger metadata wiring, GraphQL context passthrough, and channel trace propagation
- [x] Step 4: Run focused observability-context tests to verify GREEN
- [x] Step 5: Run `mix compile` + `mix typecheck`, update checklist progress, and commit the correlation milestone

**Task 3 behavior targets:**

- HTTP requests receive a stable `trace_id` in addition to Phoenix `request_id`.
- GraphQL context exposes correlation metadata to adapter-layer code without changing Relay schema contracts.
- Live channel telemetry includes correlation metadata alongside existing `session_id`/`user_id` fields.
- Correlation plumbing remains adapter-scoped and never persists raw tokens or client secrets.

**Suggested verification command:**

```bash
mix test test/live_canvas_web/plugs/observability_context_test.exs test/live_canvas_gql/context_test.exs test/live_canvas_web/channels/live_session_channel_test.exs
```

Expected: RED first, then GREEN after the new plug/context/channel plumbing lands.

### Task 4: Publish The Observability Contract, Refresh Roadmap Tracking, And Run Final Verification

**Files:**
- Create: `docs/release/observability-metrics.md`
- Modify: `docs/release/deployment-gates.md`
- Modify: `docs/release/staged-rollout.md`
- Modify: `docs/plans/2026-03-03-backend-release-readiness-roadmap.md`
- Modify: `docs/plans/release/2026-03-27-observability-metrics-and-correlation.md`

**Task 4 Step Progress:**
- [x] Step 1: Document the exported metric names, tag policy, enablement knobs, auth expectations, and correlation fields in a dedicated release runbook
- [x] Step 2: Update rollout/gate docs so dashboard and SLO checks reference concrete metrics and correlation fields instead of generic placeholders
- [x] Step 3: Update the release roadmap evidence notes so this Phase 5 gap is tracked accurately
- [x] Step 4: Run final verification (`mix compile`, focused observability tests, `mix typecheck`, and `mix release.gates --dry-run`)
- [x] Step 5: Mark tasks complete and commit the final observability milestone

**Step 1-3 implementation notes (completed):**

- Added `docs/release/observability-metrics.md` to publish the scrape endpoint contract, concrete metric families, label policy, rollout queries, and correlation-field expectations.
- Updated `docs/release/deployment-gates.md` and `docs/release/staged-rollout.md` so release checks now cite explicit HTTP/live/auth metric families plus required correlation metadata instead of generic dashboard placeholders.
- Refreshed `docs/plans/2026-03-03-backend-release-readiness-roadmap.md` so the Phase 5 observability gap is tracked as delivered with direct evidence links into the code, tests, and runbooks.

**Step 4-5 verification run (2026-03-27):**

- `mix test test/live_canvas_web/telemetry_test.exs test/live_canvas_web/controllers/metrics_endpoint_test.exs test/live_canvas_web/plugs/observability_context_test.exs test/live_canvas_gql/context_test.exs test/live_canvas_web/channels/live_session_channel_test.exs` -> PASS (`33 tests, 0 failures`)
- `mix compile` -> PASS
- `mix typecheck` -> PASS
- `mix release.gates --dry-run` -> PASS

**Task 4 verification command:**

```bash
mix test test/live_canvas_web/telemetry_test.exs test/live_canvas_web/controllers/metrics_endpoint_test.exs test/live_canvas_web/plugs/observability_context_test.exs test/live_canvas_gql/context_test.exs test/live_canvas_web/channels/live_session_channel_test.exs
mix compile
mix typecheck
mix release.gates --dry-run
```

Expected: PASS.
