# Directional Block Privacy Completion Record

Date: 2026-07-09
Status: implemented, review-hardened, and published as PR #116

## Invariant

For authenticated viewer `V` and target `T`, if `T` blocked `V`, public
GraphQL and mobile surfaces behave as though `T` does not exist. If only `V`
blocked `T`, `T` remains resolvable and may report `BLOCKED`. Content, chat,
and live-session authorization remain symmetric across either block direction.

## Final Architecture

- `LC.Social.blocked_by?/2` owns the temporary directional predicate.
- Profile nodes, social reads, and social mutations normalize hidden targets to
  the existing missing-target contract before returning data or writing.
- Followers, following, pending requests, and contact matches omit users who
  blocked the viewer.
- Contact projection resolves blocking IDs once and shares one pure projection
  path for singleton and list responses.
- Mobile identity-bearing queries use one privacy-sensitive network policy.
- Viewer-owned profile data remains cache-friendly while third-party social
  previews refresh inside their own Suspense/error boundary.
- A stacked redesign moves relationship facts and visibility policy into
  `LC.ReadPolicy`; see
  `docs/superpowers/plans/2026-07-10-read-policy-redesign.md`.

## Milestone Commits

- `d2558bd` design directional block privacy
- `4887763` add directional block visibility policy
- `b0c3d9d` hide blockers from profile reads
- `0b1f496` close social mutation block oracles
- `1ea83f7` filter blockers from user discovery
- `6edf601` prove blocked-profile indistinguishability
- `8768f8d` prevent cached blocker identity leaks
- `48952d1` clarify contact visibility projection
- `2b25a8b` isolate privacy-sensitive profile queries

## Verification Evidence

- Original focused privacy suite: 144 tests, 0 failures.
- Related feed/chat authorization suite: 69 tests, 0 failures.
- Contact projection cleanup: 20 tests, 0 failures; singleton/list paths each
  retain one block query per operation.
- Final affected backend suite: 144 tests, 0 failures.
- Viewer-profile cache transition and profile navigation: 4 tests, 0 failures.
- Full mobile suite: 457 Bun tests and 84 Jest tests, 0 failures.
- Mobile production/test TypeScript checks and ESLint: passed.
- Relay generation: passed with the expected query/mutation artifact split.
- `mix compile --warnings-as-errors`: passed.
- `mix typecheck`: passed with 0 errors.
- `mix boundary.spec`: passed.
- Touched-file formatting and `git diff --check`: passed.
- `mix slop.changed`: no Credo or cross-function smell findings.

## Repository Advisories

- The full backend suite previously retained two failures in unchanged
  seed-data and legacy live-session-flow tests; one unrelated feed test passed
  when rerun alone.
- Repository-wide formatting previously reported seven unchanged files outside
  this change. Touched Elixir files are checked independently.

## Deferred Scope

- unblock and unfollow APIs and mobile controls;
- deleting follow rows when a block is created;
- schema enum or Relay ID changes;
- staff moderation redesign;
- release-candidate device QA and contact-invite delivery.
