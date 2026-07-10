# Directional Block Quality Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the local maintainability smells in PR #116 without changing its directional block-privacy behavior or preempting the stacked `LC.ReadPolicy` redesign.

**Architecture:** Make contact visibility reads explicit and projection pure, split viewer-owned profile data from network-fresh third-party social previews, centralize privacy-sensitive Relay options, and replace the completed execution checklist with a compact closure record. The Social policy API remains otherwise stable until the stacked redesign.

**Tech Stack:** Elixir, Ecto, Absinthe Relay, ExUnit, React Native, Expo Router, Relay, Jest/RNTL.

## Global Constraints

- Work only on `codex/directional-block-privacy`; PR #116 continues to target `main`.
- Preserve hidden/missing equivalence and viewer-owned `BLOCKED` behavior.
- Preserve one block query for contact lists and one for singleton projections.
- Never render cached third-party identity before network reauthorization.
- Keep mobile tests under `mobile/tests/**`.
- Do not move policy ownership into `LC.ReadPolicy` in this plan.
- Add typespecs for new public Elixir functions.

---

## File Structure

- `lib/live_canvas/social.ex`: exposes one explicitly I/O-bearing blocker-ID lookup for the temporary Social-owned policy.
- `lib/live_canvas_gql/accounts/contact_resolver.ex`: owns visible contact mapping and pure scalar projection.
- `lib/live_canvas_gql/schema.ex`: calls the explicitly visible singleton contact entry point.
- `mobile/src/relay/privacySensitiveFetch.ts`: owns the shared Relay option for identity-bearing reads.
- `mobile/src/profile/viewer/ViewerProfileScreen.tsx`: owns only viewer-safe profile, privacy, and live-session data.
- `mobile/src/profile/viewer/ViewerProfileSocialSections.tsx`: owns network-fresh social previews and follow-request actions.
- `mobile/tests/profile/ViewerProfileCachePrivacy.rntl.tsx`: proves cached viewer-safe data renders while cached third-party identities remain withheld.
- `docs/superpowers/plans/2026-07-09-directional-block-privacy.md`: becomes a compact completed-plan record.

---

### Task 1: Make Contact Visibility I/O Explicit and Projection Pure

**Files:**
- Modify: `test/live_canvas/social_test.exs`
- Modify: `test/live_canvas_gql/accounts/contact_resolver_test.exs`
- Modify: `test/live_canvas_gql/accounts/contact_queries_test.exs`
- Modify: `lib/live_canvas/social.ex`
- Modify: `lib/live_canvas_gql/accounts/contact_resolver.ex`
- Modify: `lib/live_canvas_gql/schema.ex`

**Interfaces:**
- Produces: `Social.user_ids_blocking_viewer(viewer, users) :: [pos_integer()]`.
- Produces: `ContactResolver.visible_contact_match_node(match, viewer)` and `visible_contact_match_nodes(matches, viewer)`.
- Keeps: `project_contact_match(match, blocking_ids)` private and database-free.

- [x] **Step 1: Write API and purity regressions**

Replace the Social list-filter assertion with an ID-set assertion:

```elixir
assert Social.user_ids_blocking_viewer(viewer, [visible_first, hidden, visible_last]) ==
         [hidden.id]
```

Rename the contact resolver test to `visible_contact_match_node/2`, call that function, and wrap it in `capture_repo_queries/1`; assert the projected map is unchanged and `count_table_queries(queries, "blocks") == 1`. Keep the existing GraphQL list test asserting one blocks query across three rows.

- [x] **Step 2: Run focused tests and verify RED**

Run:

```bash
mix test test/live_canvas/social_test.exs test/live_canvas_gql/accounts/contact_resolver_test.exs test/live_canvas_gql/accounts/contact_queries_test.exs
```

Expected: compilation failures for `user_ids_blocking_viewer/2` and `visible_contact_match_node/2`.

- [x] **Step 3: Implement one blocker-ID read and one projection path**

Replace `reject_users_blocking_viewer/2` with:

```elixir
@spec user_ids_blocking_viewer(User.t(), [User.t()]) :: [pos_integer()]
def user_ids_blocking_viewer(%User{}, []), do: []

def user_ids_blocking_viewer(%User{id: viewer_id}, users) when is_list(users) do
  user_ids = Enum.map(users, & &1.id)

  from(block in Block,
    where: block.blocked_id == ^viewer_id and block.blocker_id in ^user_ids,
    select: block.blocker_id
  )
  |> Repo.all()
end
```

In `ContactResolver`, implement the public entry points so the singleton delegates to the batch path:

```elixir
def visible_contact_match_node(contact_match, %User{} = viewer) do
  [contact_match]
  |> visible_contact_match_nodes(viewer)
  |> List.first()
end

def visible_contact_match_nodes(contact_matches, %User{} = viewer) do
  blocking_ids =
    contact_matches
    |> Enum.flat_map(& &1.matched_users)
    |> then(&Social.user_ids_blocking_viewer(viewer, &1))
    |> MapSet.new()

  Enum.map(contact_matches, &project_contact_match(&1, blocking_ids))
end

defp project_contact_match(contact_match, blocking_ids) do
  contact_match
  |> put_contact_scalars()
  |> Map.update!(:matched_users, fn users ->
    Enum.reject(users, &MapSet.member?(blocking_ids, &1.id))
  end)
end
```

Update list, payload, and schema callers to use the `visible_*` names. Keep `put_contact_scalars/1` private and pure.

- [x] **Step 4: Run focused tests and verify GREEN**

Run the Task 1 command again.

Expected: PASS; singleton and list projections preserve shape, with one block query per operation.

- [x] **Step 5: Commit the backend cleanup**

```bash
git add lib/live_canvas/social.ex lib/live_canvas_gql/accounts/contact_resolver.ex lib/live_canvas_gql/schema.ex test/live_canvas/social_test.exs test/live_canvas_gql/accounts/contact_resolver_test.exs test/live_canvas_gql/accounts/contact_queries_test.exs
git commit -m "refactor: clarify contact visibility projection"
```

---

### Task 2: Split Viewer-Safe and Privacy-Sensitive Mobile Queries

**Files:**
- Create: `mobile/src/relay/privacySensitiveFetch.ts`
- Create: `mobile/src/profile/viewer/ViewerProfileSocialSections.tsx`
- Create: `mobile/tests/profile/ViewerProfileCachePrivacy.rntl.tsx`
- Modify: `mobile/src/profile/viewer/ViewerProfileScreen.tsx`
- Modify: `mobile/src/profile/other/OtherUserProfileScreen.tsx`
- Modify: `mobile/src/profile/ProfileConnectionListScreen.tsx`
- Modify: `mobile/src/profile/PendingFollowRequestsScreen.tsx`
- Modify: `mobile/src/contacts/ContactDiscoveryScreen.tsx`
- Modify: `mobile/tests/profile/ProfilePreviewLinks.rntl.tsx`
- Generate: `mobile/src/__generated__/ViewerProfileScreenQuery.graphql.ts`
- Generate: `mobile/src/__generated__/ViewerProfileSocialSectionsQuery.graphql.ts`
- Generate: `mobile/src/__generated__/ViewerProfileSocialSectionsAcceptFollowRequestMutation.graphql.ts`
- Generate: `mobile/src/__generated__/ViewerProfileSocialSectionsDeclineFollowRequestMutation.graphql.ts`

**Interfaces:**
- Produces: `PRIVACY_SENSITIVE_FETCH_OPTIONS = { fetchPolicy: 'network-only' } as const`.
- Produces: `ViewerProfileSocialSections`, which owns social preview query, follow-request reducer, and accept/decline mutations.
- Keeps: `ViewerProfileScreen` responsible for viewer identity, privacy mode, and current live session.

- [x] **Step 1: Write the real Relay cache-transition regression**

Seed a real Relay `Environment` with both generated operations:

```typescript
environment.commitPayload(viewerOperation, cachedViewerProfile());
environment.commitPayload(socialOperation, cachedSocialProfiles());
```

Render `ViewerProfileScreen` under `RelayEnvironmentProvider`. Assert the viewer-owned heading is visible immediately, `Refreshing social activity...` is visible, and cached follower/requester emails are absent. Resolve the social network operation with empty connections and assert the social sections render without either cached identity.

- [x] **Step 2: Run the new test and verify RED**

Run from `mobile/`:

```bash
bun run test:jest -- tests/profile/ViewerProfileCachePrivacy.rntl.tsx --runInBand
```

Expected: FAIL because the current monolithic `network-only` query suspends the entire profile and no social child operation exists.

- [x] **Step 3: Add the shared fetch option and extract the social child**

Create:

```typescript
export const PRIVACY_SENSITIVE_FETCH_OPTIONS = {
  fetchPolicy: 'network-only',
} as const;
```

Use it for every initial/load-more identity-bearing query touched by PR #116. In `ViewerProfileScreenQuery`, retain only `viewer { id email privacyMode currentLiveSession { ... } }` and restore `store-and-network`.

Move followers, following, `viewerPendingFollowRequests`, the follow-request reducer/ref, and accept/decline mutations into `ViewerProfileSocialSections`. Its query must use `PRIVACY_SENSITIVE_FETCH_OPTIONS`. Wrap it inside the existing `ScrollView` with a local error boundary and:

```tsx
<Suspense
  fallback={
    <AppCard>
      <Text>Refreshing social activity...</Text>
    </AppCard>
  }
>
  <ViewerProfileSocialSections />
</Suspense>
```

Keep all navigation labels, empty messages, and mutation error copy unchanged. Update the mocked profile-preview test so `useLazyLoadQuery` returns base or social data based on the operation text.

- [x] **Step 4: Generate Relay output and verify GREEN**

Run from `mobile/`:

```bash
bun run relay
bun run test:jest -- tests/profile/ViewerProfileCachePrivacy.rntl.tsx tests/profile/ProfilePreviewLinks.rntl.tsx --runInBand
```

Expected: Relay succeeds; both suites pass; cached third-party identities never render.

- [x] **Step 5: Commit the mobile cleanup**

```bash
git add mobile/src mobile/tests/profile/ViewerProfileCachePrivacy.rntl.tsx mobile/tests/profile/ProfilePreviewLinks.rntl.tsx
git commit -m "refactor: isolate privacy-sensitive profile queries"
```

---

### Task 3: Condense the Completed Plan, Verify, and Push PR #116

**Files:**
- Modify: `docs/superpowers/plans/2026-07-09-directional-block-privacy.md`
- Modify: `docs/superpowers/specs/2026-07-10-read-policy-redesign-design.md`
- Modify: lane `NOW.md` files only if execution status was activated.

**Interfaces:**
- Produces: a completed-plan record under 120 lines.
- Produces: approved design status and exact verification evidence.

- [ ] **Step 1: Replace checklist duplication with a closure record**

Keep only: goal/invariant, final architecture, milestone commit list, focused verification evidence, baseline advisories, stacked redesign pointer, and deferred unblock/unfollow scope. Remove copied implementation code and completed step-by-step commands. Change the redesign spec status to `approved for implementation`.

- [ ] **Step 2: Run complete base-PR verification**

Run:

```bash
mix format --check-formatted lib/live_canvas/social.ex lib/live_canvas_gql/accounts/contact_resolver.ex lib/live_canvas_gql/schema.ex test/live_canvas/social_test.exs test/live_canvas_gql/accounts/contact_resolver_test.exs test/live_canvas_gql/accounts/contact_queries_test.exs
mix test test/live_canvas/social_test.exs test/live_canvas_gql/accounts/contact_resolver_test.exs test/live_canvas_gql/accounts/contact_queries_test.exs test/live_canvas_gql/accounts/account_mutations_test.exs test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/social/social_queries_test.exs test/live_canvas_gql/social/social_mutations_test.exs test/integration/feed_visibility_flow_test.exs
mix compile --warnings-as-errors
mix typecheck
mix boundary.spec
mix slop.changed
cd mobile && bun run relay && bun run test:quality
git diff --check
```

Expected: all affected checks pass. Report unrelated repository-wide baseline failures separately without changing unrelated files.

- [ ] **Step 3: Commit closure documentation**

```bash
git add docs/superpowers/plans/2026-07-09-directional-block-privacy.md docs/superpowers/specs/2026-07-10-read-policy-redesign-design.md docs/plans/NOW.md docs/plans/backend/NOW.md docs/plans/mobile/NOW.md
git commit -m "docs: close directional privacy cleanup"
```

- [ ] **Step 4: Push and read back PR #116**

```bash
git push
```

Confirm the remote head equals local HEAD, PR #116 remains open/non-draft/mergeable, and the PR body names the new mobile query boundary and contact projection cleanup.
