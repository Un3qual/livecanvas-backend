# Read-Policy Redesign and Quality Stack

Date: 2026-07-10
Status: implemented and verified
Owner: backend and mobile lanes

## Goal

Finish the maintainability cleanup for directional block privacy without
expanding PR #116 into a policy rewrite, then deliver the policy rewrite as a
stacked PR. The resulting architecture must keep one authority for relationship
facts and viewer-visibility decisions while preserving every public GraphQL and
mobile behavior established by PR #116.

## Stack Shape

1. `codex/directional-block-privacy` remains based on `main` and owns the
   user-visible privacy fix plus its local quality cleanup.
2. `codex/read-policy-redesign` branches from the updated privacy branch.
3. The redesign PR targets `codex/directional-block-privacy`, not `main`, until
   PR #116 merges. Its diff therefore contains only the policy redesign.

No force-push or history rewrite is required. If the base PR changes during
review, the stacked branch will merge or rebase the updated base before its own
verification is refreshed.

## PR #116 Quality Cleanup

### Contact projections

- Rename viewer-filtered contact projection entry points so their I/O is
  explicit.
- Resolve blocking user IDs once per projection batch.
- Keep scalar/contact-map projection pure and share it between singleton and
  list paths.
- Preserve one block query for a contact connection and one for a singleton
  node or mutation payload.

The current Social query API remains stable in this PR because the stacked
redesign will replace its policy ownership.

### Mobile query boundaries

- Centralize the Relay option used by queries that must reauthorize cached
  identity-bearing data.
- Keep the viewer's own profile, privacy controls, and live-session summary in
  a cache-friendly base query.
- Move follower, following, and pending-request previews into a network-fresh
  child query under a local Suspense/error boundary.
- Move follow-request mutation state with the social-preview child so the
  component boundary remains cohesive and introduces no duplicated state.
- Keep the existing full-list screens network-fresh.

The screen may render its safe viewer-owned profile while social previews are
being reauthorized, but it must never render cached third-party identity rows.

### Documentation

Replace the completed 393-line implementation checklist with a short closure
record containing the invariant, final architecture, milestone commits,
verification evidence, and deferred work. The design documents remain the
durable explanation; the completed plan must not duplicate source code.

## Stacked `LC.ReadPolicy` Redesign

### Boundary ownership

`LC.ReadPolicy` becomes the public authority for relationship facts and
viewer-scoped read decisions. Internal module `LC.ReadPolicy.Relationships`
owns Ecto details under the same boundary, while callers use action-specific
facade functions from `LC.ReadPolicy`.

The facade will distinguish these policies explicitly:

- directional user resolution: the target blocked the viewer;
- symmetric owner/content visibility: either party blocked the other;
- directional mute state;
- follow/relationship state;
- query scopes and blocking-ID lookups needed for batch projections.

The redesign must not introduce a generic policy DSL. Function names should
state the actor, target, and action being decided.

### Callers

- `LC.Social` retains social mutations and Follow/Block/Mute persistence.
- Social follower/following queries compose explicit `LC.ReadPolicy` scopes and
  use names that distinguish public from viewer-visible results.
- GraphQL resolvers decode IDs, obtain the viewer, call domain policy, paginate,
  and normalize existing error shapes; they do not encode block direction.
- Contact projections consume ReadPolicy blocking-ID results without hidden
  per-row queries.
- Feed, chat, and live-session code retain symmetric semantics while reusing the
  consolidated relationship facts.

### Compatibility

- Hidden and missing users remain observationally identical.
- Viewer-owned blocks remain resolvable and may report `BLOCKED`.
- Content, live-session, and chat visibility remain symmetric.
- Staff moderation, Relay IDs, GraphQL schema fields, persistence, and mobile
  copy remain unchanged.
- Temporary Social-owned policy helpers are removed after all callers migrate;
  no duplicate compatibility facade remains without a demonstrated caller.

## Testing and Verification

PR #116 cleanup will use focused backend projection/query tests, a real Relay
cache-transition test for the viewer-profile split, Relay generation, the full
mobile quality suite, formatter checks, typecheck, boundary checks, and the
changed-code smell gate.

The stacked PR will begin with characterization tests for every policy function
and query scope being moved. Tests will then be updated to express the new
ReadPolicy API before production callers migrate. Final verification includes
the focused privacy suite, related feed/chat/live authorization tests,
`mix compile --warnings-as-errors`, `mix typecheck`, `mix boundary.spec`,
`mix slop.changed`, touched-file formatting, and `git diff --check`.

## Non-Goals

- changing consumer privacy behavior;
- migrating authorization to LetMe;
- adding unblock or unfollow APIs;
- changing database schemas or indexes;
- redesigning staff moderation;
- broad cleanup outside relationship and viewer-visibility policy.

## Implementation Result

- `LC.ReadPolicy.Relationships` now owns block, mute, follow-state, and batched
  blocker-ID reads; `LC.ReadPolicy` exposes the action-specific public facade.
- Social retains relationship mutations and authorized relationship-graph
  queries. Owner privacy is checked before a query is returned, so callers
  cannot select a fail-open public path.
- GraphQL user resolution, social reads, graph authorization, and contact
  projection now call `ReadPolicy` without encoding block direction locally.
- Generic Ecto scope composition lives in internal `LC.ReadPolicy.Scopes`; the
  exported facade exposes action-specific post, live-session,
  relationship-graph user, and pending-follow-request query policies.
- Repo-query capture now uses unique references, caller-chain scoping, and an
  explicit participant wrapper for raw workers, then detaches before draining.
  This preserves meaningful async query-count assertions without cross-test
  contamination or worker under-counting.

Fresh verification: touched-file formatting, warning-free compilation,
Dialyzer with 0 errors, Boundary, and changed-code analysis passed; the focused
policy/privacy/authorization suite passed 216 tests with 0 failures. The full
backend suite passed 931 tests with 0 failures and 1 excluded test.
