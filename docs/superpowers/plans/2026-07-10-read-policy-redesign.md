# ReadPolicy Redesign Closure

Date: 2026-07-10
Status: implemented, reviewed, and verified
Stack: PR #118 on PR #116 (`codex/directional-block-privacy`)

## Invariant

Blocked identities remain observationally missing to the blocked viewer. Owner
privacy is derived from the persisted owner, not accepted as a caller-provided
policy input. Content, chat, and live-session visibility retain their symmetric
block and directional mute behavior.

## Final Architecture

- `LC.ReadPolicy.Relationships` owns block, mute, follow-state, and batched
  blocker-ID reads.
- `LC.ReadPolicy.Scopes` is internal and owns the generic Ecto binding/join
  mechanics.
- The exported `LC.ReadPolicy` facade exposes owner-derived decisions and
  action-specific scopes for posts, live sessions, relationship-graph users,
  and pending follow requests.
- `LC.Social.visible_follower_users_query/2` and
  `visible_following_users_query/2` authorize the relationship graph before
  returning a query; no public raw-query escape hatch remains.
- GraphQL obtains the optional viewer, delegates graph authorization to Social,
  paginates authorized queries, and preserves empty-connection behavior for
  hidden graphs.
- Repo-query capture tags each capture, accepts the originating process, its
  `$callers` chain, or raw workers using the explicit participant wrapper,
  detaches before draining, and remains safe in async test modules.

## Review Remediation

- Removed caller-supplied visibility from `relationship_state/2` and
  `viewer_can_view_relationship_graph?/2`.
- Replaced the generic exported query DSL with action-specific facade methods.
- Removed duplicate public/viewer relationship-query APIs and reflection tests
  for absent legacy functions.
- Added negative controls for private-owner graph access and unrelated-process
  telemetry, plus coverage for explicitly participating raw workers.
- Rebasing preserved PR #116's self-block constraint, nested timeline privacy,
  Relay retry fixes, and shared mutation documents.

## Verification

- 216 focused policy, social, feed, chat, contact, Relay-node, GraphQL, and
  integration tests: 0 failures.
- Timeline channel integration test: 1 test, 0 failures.
- Full backend suite: 931 tests, 0 failures, 1 excluded.
- `mix compile --warnings-as-errors`: passed.
- `mix typecheck`: passed with 0 Dialyzer errors.
- `mix boundary.spec`: passed; internal scope modules remain unexported.
- `mix slop.changed`: passed with no changed-code issues.
- Touched-file formatting and `git diff --check`: passed.

## Publication

Push the rebased branch with `--force-with-lease` because PR #118 history was
rebased onto the final PR #116 head. Keep PR #118 based on
`codex/directional-block-privacy` until PR #116 merges.
