# Directional Block Quality Cleanup Closure Record

**Status:** Completed on `codex/directional-block-privacy` for PR #116.

**Goal:** Remove local maintainability smells without changing directional
block privacy or preempting the stacked `LC.ReadPolicy` redesign.

**Final architecture:** Contact visibility performs one explicit blocker-ID
read and then uses a pure projection path. Viewer-owned profile data remains
cache-friendly, while third-party social identity is isolated behind
network-fresh Relay queries and a local Suspense/error boundary.

## Constraints Preserved

- A user who blocked the viewer remains indistinguishable from a missing user.
- Viewer-owned `BLOCKED` state remains visible where the existing contract
  requires it.
- Contact singleton and list projections each issue one blocks-table query.
- Cached third-party identity never renders before network reauthorization.
- Mobile tests remain under `mobile/tests/**`.
- Read-policy ownership stays in `LC.Social` until the stacked redesign.

## Executor Brief 1: Contact Visibility Projection

**Relevant symbols:** `Social.user_ids_blocking_viewer/2`,
`ContactResolver.visible_contact_match_node/2`,
`ContactResolver.visible_contact_match_nodes/2`.

**Result:** The resolver performs one batched blocker-ID lookup, converts the
result to a `MapSet`, and sends singleton and list responses through the same
database-free scalar projection. Schema and payload callers use the explicit
`visible_*` entry points.

**Verification:** Social, direct-resolver, and GraphQL contact tests assert the
projected shape and one blocks query per operation.

## Executor Brief 2: Privacy-Sensitive Mobile Queries

**Relevant symbols:** `PRIVACY_SENSITIVE_FETCH_OPTIONS`,
`ViewerProfileScreen`, `ViewerProfileSocialSections`.

**Result:** Viewer identity, privacy mode, and live-session data stay in the
cache-friendly base query. Followers, following, and pending requests use a
network-only child query under a local boundary. All identity-bearing reads
touched by PR #116 share the same fetch option.

**Verification:** Real Relay cache-transition tests prove viewer-owned data can
render immediately while cached follower/requester identities remain hidden.

## Executor Brief 3: Closure and Publication

The original directional-privacy checklist was replaced with a compact closure
record. The redesign specification was approved for implementation, and the
lane pointers were updated only where execution status changed.

## Milestone Commits

- `48952d1` — clarify contact visibility projection.
- `2b25a8b` — isolate privacy-sensitive profile queries.
- `41528d6` — keep blocker ID sets local to the projection boundary.
- `d8463d8` — close directional privacy cleanup.
- `75b6ac6` — record privacy cleanup publication.

## Final Verification

- Affected backend privacy suite: 144 tests, 0 failures.
- Related feed/chat authorization suite: 69 tests, 0 failures.
- `mix compile --warnings-as-errors`.
- `mix typecheck`: 0 errors.
- `mix boundary.spec`.
- `mix slop.changed`: no changed-code findings.
- Touched-file `mix format --check-formatted`.
- `bun run relay`.
- `bun run test:quality`: Bun 457 tests and Jest 84 tests, 0 failures.
- `git diff --check`.

## Baseline Advisories

The full backend suite retains unrelated failures in seed-data/live-session
tests, and repository-wide formatting retains seven unchanged files. Those
baselines were recorded without changing unrelated code.

## Next Step

Execute the approved stacked redesign in
`docs/superpowers/plans/2026-07-10-read-policy-redesign.md` from the exact
remote PR #116 head.
