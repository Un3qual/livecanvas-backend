# Performance And Capacity Verification Runbook

Use this runbook to execute and record deterministic release-capacity probes for feed query load, channel fanout, and live-session concurrency.

## Owners

- Release Engineer: runs commands and captures output evidence.
- Feed/Chat/Live Owners: validate threshold values and probe outcomes.
- Incident Commander (IC): approves go/no-go after reviewing evidence.

## Prerequisites

1. Confirm the current branch tip is the release candidate under review.
2. Run `mix release.gates --dry-run` and verify `mix release.capacity_drill --confirm` appears in order.
3. Pick threshold and probe-size values for the environment under test.

## Command Usage

- Dry-run plan (safe preview):
  - `MIX_ENV=test mix release.capacity_drill --dry-run`
- Execute default thresholds:
  - `MIX_ENV=test mix release.capacity_drill --confirm`

`--confirm` is required in non-test environments.

## Threshold Override Guidance

Use overrides only when the default probe sizes or latency thresholds are misaligned for the target environment:

```bash
MIX_ENV=test mix release.capacity_drill --confirm \
  --feed-iterations 300 \
  --fanout-viewers 75 \
  --concurrency-viewers 45 \
  --feed-mean-ms 140 \
  --feed-p95-ms 220 \
  --channel-min-delivery-rate 0.99 \
  --channel-p95-ms 240 \
  --live-min-success-rate 0.99 \
  --live-p95-ms 360
```

When overrides are applied:

1. Attach the full command arguments in the release ticket.
2. Document why defaults were rejected and who approved the override.
3. Keep success-rate thresholds in the `0.0..1.0` range.
4. Run dry-run output first when changing probe sizes.

## Required Evidence For Release Ticket

- Commit SHA and environment (`MIX_ENV`).
- Dry-run output (ordered step list) attached.
- Execution output showing per-probe `status`, `sample_size`, `success_rate`, `mean_ms`, and `p95_ms`.
- Overall drill status (`pass` or `fail`).
- Any override arguments plus owner approval note.
- Follow-up issue link for any failing probe or waived threshold.
