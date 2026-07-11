# ReadPolicy Redesign Implementation Plan

> **Executor:** Use `superpowers:executing-plans` and complete each brief in
> order. Keep milestone commits scoped to one brief.

**Goal:** Consolidate relationship facts and viewer-visibility decisions under
`LC.ReadPolicy` in a PR stacked on the directional-privacy branch.

**Architecture:** `LC.ReadPolicy.Relationships` owns Ecto relationship reads;
the `LC.ReadPolicy` facade owns action-specific decisions and query scopes.
`LC.Social` retains mutations and explicit graph queries. GraphQL adapts IDs,
pagination, and established error contracts without owning policy.

## Global Constraints

- Start from the exact pushed `codex/directional-block-privacy` head.
- Target the stacked PR at `codex/directional-block-privacy`, not `main`.
- Preserve PR #116 responses, directional profile hiding, symmetric
  content/chat/live authorization, and query counts.
- Do not add a policy DSL, persistence migration, LetMe migration, or unused
  compatibility wrappers.
- Add typespecs for public functions and run `mix typecheck` and
  `mix boundary.spec`.

## Brief 1: Relationship Facts

**Goal:** Move block, mute, follow-state, and blocker-ID reads behind the policy
facade.

**Relevant symbols:** `LC.ReadPolicy.Relationships`,
`viewer_blocked_by_owner?/2`, `blocked_between?/2`,
`viewer_muted_owner?/2`, `relationship_state/3`,
`viewer_can_view_relationship_graph?/3`, `blocking_owner_ids/2`.

- [ ] Fetch the base branch, create the stacked branch from its exact remote
      commit, and verify equality:

  ```bash
  git fetch origin codex/directional-block-privacy
  git switch -c codex/read-policy-redesign origin/codex/directional-block-privacy
  test "$(git rev-parse HEAD)" = "$(git rev-parse origin/codex/directional-block-privacy)"
  ```

- [ ] Add direct failing policy tests for both block directions, symmetric
      block state, mute direction, follow states, graph visibility, and batched
      blocker IDs.
- [ ] Implement typed facade functions backed by the internal relationships
      module; keep `viewer_can_read_owner?/3` behavior unchanged.
- [ ] Verify with:
      `mix test test/live_canvas/read_policy_test.exs test/live_canvas/social_test.exs`.
- [ ] Commit as `refactor: centralize relationship policy facts`.

## Brief 2: Directional Query Scopes

**Goal:** Replace duplicated block joins and ambiguous Social graph-query names
with one composable policy scope and explicit public/viewer APIs.

**Relevant symbols:** `ReadPolicy.exclude_owners_blocking_viewer/3`,
`Social.public_follower_users_query/1`,
`Social.viewer_follower_users_query/2`,
`Social.public_following_users_query/1`,
`Social.viewer_following_users_query/2`.

- [ ] Add failing root-`User` and `Follow` scope tests proving only owners who
      blocked the viewer are removed.
- [ ] Rename the graph queries and update Social plus seed-data callers.
- [ ] Reuse the policy scope for pending requests with `:follower_id`.
- [ ] Verify with the read-policy, Social, and seed-data tests; expect explicit
      public/viewer APIs and a single directional scope implementation.
- [ ] Commit as `refactor: centralize directional visibility scopes`.

## Brief 3: Caller Migration

**Goal:** Route GraphQL and contact reads through `ReadPolicy`, then remove
Social-owned read-policy wrappers.

**Relevant removals:** `Social.blocked_by?/2`,
`user_ids_blocking_viewer/2`, `muted?/2`, `relationship_state/2`,
`can_view_user?/2`, and the ambiguous graph-query names.

- [ ] Update tests to the final policy API and verify the obsolete calls fail.
- [ ] Migrate user-node lookup, visible-target lookup, relationship/mute reads,
      graph authorization, explicit graph queries, and contact blocker IDs.
- [ ] Keep missing-user normalization unchanged and keep
      `viewer_can_read_owner?/3` on content/chat/live paths where mute state is
      part of visibility.
- [ ] Run the privacy, contact, Relay-node, social mutation/query, feed, and chat
      authorization suites.
- [ ] Commit as `refactor: route visibility through read policy`.

## Brief 4: Verification and Publication

**Goal:** Prove compatibility, record exact evidence, and publish only the
stacked redesign diff.

- [ ] Run touched-file formatting, warning-free compilation, `mix typecheck`,
      `mix boundary.spec`, `mix slop.changed`, and `git diff --check`.
- [ ] Confirm no removed Social read-policy calls remain.
- [ ] Mark the redesign spec/plan complete and record exact results.
- [ ] Commit closure evidence as `docs: close read policy redesign`.
- [ ] Push `codex/read-policy-redesign`, open a non-draft PR against
      `codex/directional-block-privacy`, and confirm its diff excludes PR #116
      commits.
