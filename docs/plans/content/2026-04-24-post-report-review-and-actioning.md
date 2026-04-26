# Post Report Review And Actioning Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make viewer-submitted post reports actionable by adding moderator-gated review, dismissal, and post-removal workflows.

**Architecture:** Introduce a fresh database-backed staff role check in `LC.Accounts`, add durable moderation state to posts so actioned content can be hidden without destructive deletes, and put cross-context report review orchestration in a new `LC.Moderation` boundary. Keep user-facing report submission reporter-scoped, keep moderator queue access staff-scoped, and ensure Relay node refetch cannot expose reports across either boundary.

**Tech Stack:** Elixir, Phoenix, Ecto, PostgreSQL, Absinthe Relay, ExUnit

---

## Source Verification

- `docs/plans/2026-03-03-backend-release-readiness-roadmap.md` shows product-facing content report follow-up as the remaining non-operational gap after `updatePost`/`deletePost`.
- `docs/plans/content/2026-04-24-post-reporting.md` is complete through Task 2 and explicitly leaves staff review queues, admin decisions, notifications, and report status transitions out of scope.
- Current code has `post_reports.status` values (`open`, `reviewed`, `dismissed`, `actioned`) but no review fields, no queue query, no moderator authorization model, and no post-level moderation state.
- Current feed and node visibility flow is centralized in `LC.Feed.visible_post_query/2` and `LC.Feed.get_visible_post/2`; post removal must be enforced there so `homeFeed`, profile posts, top-level `post(id:)`, and Relay `node(id:)` stay aligned.

## Scope Decisions

- Moderator and admin accounts are regular `users` rows with a `role` field. Role assignment is an operator/provisioning concern; no public GraphQL mutation should grant roles.
- Staff authorization must re-read the actor from the database and require a non-suspended user with role `:moderator` or `:admin`; resolver identity alone is not sufficient.
- Moderator action removes posts by setting a durable `posts.status = :removed`; do not hard-delete posts or reports.
- Report review starts with two GraphQL actions: `DISMISS` and `REMOVE_POST`. `DISMISS` sets report status to `:dismissed`; `REMOVE_POST` sets report status to `:actioned` and marks the post removed in the same transaction.
- Reporter-owned `PostReport` node refetch must continue to work. Staff may refetch report nodes only when the fresh staff role check passes.
- Notifications, appeals, bulk queues, machine classification, author strikes, and account suspension automation are out of scope for this slice.
- Shared mobile/client contract docs are not edited by this backend-lane batch unless the coordinator explicitly assigns that shared-doc work. Report any required contract updates after implementation.

## Progress

- [x] Task 1: Add a fresh staff-role authorization gate
- [ ] Task 2: Add post moderation state and hide removed posts from reads
- [ ] Task 3: Add the moderation context report-review workflow
- [ ] Task 4: Expose staff-scoped report review through Relay GraphQL
- [ ] Task 5: Refresh backend planning docs and report shared contract updates

### Task 1: Add A Fresh Staff-Role Authorization Gate

**Files:**
- Create: `priv/repo/migrations/20260424130000_add_user_roles.exs`
- Create: `lib/live_canvas_schemas/accounts/user_role.ex`
- Modify: `lib/live_canvas_schemas/accounts.ex`
- Modify: `lib/live_canvas_schemas/accounts/user.ex`
- Modify: `lib/live_canvas/accounts/user_changes.ex`
- Modify: `lib/live_canvas/accounts.ex`
- Modify: `test/support/fixtures/accounts_fixtures.ex`
- Modify: `test/live_canvas/accounts_test.exs`

**Step 1: Write the failing account-role tests**

Add tests under `describe "user roles and staff authorization"` in `test/live_canvas/accounts_test.exs`:

```elixir
test "staff?/1 is true only for active moderator and admin users" do
  viewer = user_fixture()
  moderator = user_fixture(role: :moderator)
  admin = user_fixture(role: :admin)

  refute Accounts.staff?(viewer)
  assert Accounts.staff?(moderator)
  assert Accounts.staff?(admin)

  assert {:ok, suspended_moderator} = Accounts.suspend_user(moderator)
  refute Accounts.staff?(suspended_moderator)
  refute Accounts.staff?(moderator)
end

test "update_user_role/2 persists supported roles and rejects invalid values" do
  user = user_fixture()

  assert {:ok, moderator} = Accounts.update_user_role(user, :moderator)
  assert moderator.role == :moderator
  assert Accounts.get_user!(user.id).role == :moderator

  assert {:error, changeset} = Accounts.update_user_role(user, :owner)
  assert %{role: ["is invalid"]} = errors_on(changeset)
end
```

Update `test/support/fixtures/accounts_fixtures.ex` so `user_fixture(role: :moderator)` works by popping `:role` before registration and applying it through `Accounts.update_user_role/2` after confirmation.

**Step 2: Run tests to verify they fail**

Run:

```bash
mix test test/live_canvas/accounts_test.exs
```

Expected: FAIL because `role`, `Accounts.staff?/1`, and `Accounts.update_user_role/2` do not exist.

**Step 3: Add the user role migration and schema fields**

Create `priv/repo/migrations/20260424130000_add_user_roles.exs`:

```elixir
defmodule LiveCanvas.Repo.Migrations.AddUserRoles do
  use Ecto.Migration
  # Keep the legacy migration module namespace for historical migration identity.

  def change do
    alter table(:users) do
      add :role, :string, null: false, default: "user"
    end

    create constraint(:users, :users_role_check,
             check: "role IN ('user', 'moderator', 'admin')"
           )

    create index(:users, [:role])
  end
end
```

Create `lib/live_canvas_schemas/accounts/user_role.ex`:

```elixir
import EctoEnum

defenum(
  LCSchemas.Accounts.UserRole,
  :user_role,
  [:user, :moderator, :admin]
)
```

Update `lib/live_canvas_schemas/accounts.ex`:

```elixir
@type user_role :: :admin | :moderator | :user
```

Update `lib/live_canvas_schemas/accounts/user.ex`:

```elixir
role: LCSchemas.Accounts.user_role() | nil,
```

and in the schema:

```elixir
field :role, LCSchemas.Accounts.UserRole, default: :user
```

**Step 4: Add role changeset and fresh staff check**

In `lib/live_canvas/accounts/user_changes.ex`, add:

```elixir
@spec role_changeset(User.t(), map()) :: Ecto.Changeset.t()
def role_changeset(user, attrs) when is_map(attrs) do
  user
  |> cast(attrs, [:role])
  |> validate_required([:role])
end
```

In `lib/live_canvas/accounts.ex`, add public typespecs and functions:

```elixir
@type role_result :: user_result()

@spec update_user_role(User.t(), LCSchemas.Accounts.user_role()) :: role_result()
def update_user_role(%User{} = user, role) do
  case user
       |> fresh_user!()
       |> UserChanges.role_changeset(%{role: role})
       |> Repo.update() do
    {:ok, updated_user} -> {:ok, hydrate_loaded_user(updated_user)}
    {:error, changeset} -> {:error, changeset}
  end
end

@spec staff?(User.t()) :: boolean()
def staff?(%User{id: user_id}) when is_integer(user_id) do
  from(user in User,
    where:
      user.id == ^user_id and
        is_nil(user.suspended_at) and
        user.role in [:moderator, :admin],
    select: 1
  )
  |> Repo.exists?()
end

def staff?(_user), do: false
```

Keep `update_user_role/2` unexposed at GraphQL boundaries; it is for operator/provisioning paths and tests in this slice.

**Step 5: Run focused verification**

Run:

```bash
mix test test/live_canvas/accounts_test.exs
mix compile
mix typecheck
```

Expected: PASS.

**Step 6: Commit the role gate**

Run:

```bash
git add priv/repo/migrations/20260424130000_add_user_roles.exs lib/live_canvas_schemas/accounts/user_role.ex lib/live_canvas_schemas/accounts.ex lib/live_canvas_schemas/accounts/user.ex lib/live_canvas/accounts/user_changes.ex lib/live_canvas/accounts.ex test/support/fixtures/accounts_fixtures.ex test/live_canvas/accounts_test.exs
git commit -m "feat: add moderator role gate"
```

**Verification outcome (2026-04-24):**

- RED: `mix test test/live_canvas/accounts_test.exs` initially failed with 2 expected failures because `LC.Accounts.update_user_role/2` was undefined and the user role field did not exist.
- GREEN: `mix test test/live_canvas/accounts_test.exs` -> PASS (`85 tests, 0 failures`; existing telemetry handler error logs were emitted by unrelated account password/reset tests).
- `mix compile` -> PASS.
- `mix typecheck` -> PASS (`Total errors: 0, Skipped: 0, Unnecessary Skips: 0`).

### Task 2: Add Post Moderation State And Hide Removed Posts From Reads

**Files:**
- Create: `priv/repo/migrations/20260424131000_add_post_moderation_state.exs`
- Modify: `lib/live_canvas_schemas/content.ex`
- Modify: `lib/live_canvas_schemas/content/post.ex`
- Modify: `lib/live_canvas/content/post.ex`
- Modify: `lib/live_canvas/content.ex`
- Modify: `lib/live_canvas/feed.ex`
- Modify: `test/live_canvas/content_test.exs`
- Modify: `test/live_canvas/feed_test.exs`
- Modify: `test/live_canvas_gql/feed/feed_queries_test.exs`
- Modify: `test/live_canvas_gql/relay/node_queries_test.exs`

**Step 1: Write failing tests for removed post visibility**

Add `LC.Content.mark_post_removed/3` coverage in `test/live_canvas/content_test.exs`:

```elixir
test "mark_post_removed/3 records moderator state with microsecond precision" do
  author = user_fixture()
  moderator = user_fixture(role: :moderator)
  {:ok, post} = Content.create_post(author, %{kind: :standard, body_text: "remove me", visibility: :public})

  assert {:ok, removed_post} =
           Content.mark_post_removed(post, moderator, %{moderation_reason: "policy_violation"})

  assert removed_post.status == :removed
  assert removed_post.moderated_by_id == moderator.id
  assert removed_post.moderation_reason == "policy_violation"
  assert %DateTime{} = removed_post.moderated_at
  assert removed_post.moderated_at.microsecond != {0, 0}
end
```

Add `LC.Feed` and GraphQL/Relay tests proving a removed post is excluded from `home_feed`, `profile_posts`, top-level `post(id:)`, and Relay `node(id:)`.

**Step 2: Run tests to verify they fail**

Run:

```bash
mix test test/live_canvas/content_test.exs test/live_canvas/feed_test.exs test/live_canvas_gql/feed/feed_queries_test.exs test/live_canvas_gql/relay/node_queries_test.exs
```

Expected: FAIL because post moderation fields and filtering do not exist.

**Step 3: Add moderation fields to posts**

Create `priv/repo/migrations/20260424131000_add_post_moderation_state.exs`:

```elixir
defmodule LiveCanvas.Repo.Migrations.AddPostModerationState do
  use Ecto.Migration
  # Keep the legacy migration module namespace for historical migration identity.

  def change do
    alter table(:posts) do
      add :status, :string, null: false, default: "active"
      add :moderated_at, :utc_datetime_usec
      add :moderated_by_id, references(:users, on_delete: :nilify_all)
      add :moderation_reason, :text
    end

    create constraint(:posts, :posts_status_check,
             check: "status IN ('active', 'removed')"
           )

    create index(:posts, [:status, :inserted_at])
    create index(:posts, [:moderated_by_id])
  end
end
```

Update `lib/live_canvas_schemas/content.ex`:

```elixir
@type post_status :: :active | :removed
```

Update `lib/live_canvas_schemas/content/post.ex` type and schema:

```elixir
status: LCSchemas.Content.post_status() | nil,
moderated_at: DateTime.t() | nil,
moderated_by_id: pos_integer() | nil,
moderated_by: User.t() | Ecto.Association.NotLoaded.t(),
moderation_reason: String.t() | nil,
```

```elixir
field :status, Ecto.Enum, values: [:active, :removed], default: :active
field :moderated_at, :utc_datetime_usec
field :moderation_reason, :string
belongs_to :moderated_by, User
```

**Step 4: Add the Content post-removal changeset and context function**

In `lib/live_canvas/content/post.ex`, add a moderation changeset:

```elixir
@type moderation_attrs :: %{
        optional(:moderated_at | :moderated_by_id | :moderation_reason | :status | String.t()) => term()
      }

@spec moderation_removal_attrs(pos_integer(), map()) :: moderation_attrs()
def moderation_removal_attrs(moderator_id, attrs)
    when is_integer(moderator_id) and is_map(attrs) do
  attrs
  |> Map.take([:moderation_reason, "moderation_reason"])
  |> Map.put(:moderated_by_id, moderator_id)
  |> Map.put(:moderated_at, DateTime.utc_now() |> DateTime.truncate(:microsecond))
  |> Map.put(:status, :removed)
end

@spec moderation_changeset(PostSchema.t(), moderation_attrs()) :: Ecto.Changeset.t()
def moderation_changeset(%PostSchema{} = post, attrs) when is_map(attrs) do
  post
  |> cast(attrs, [:status, :moderated_at, :moderated_by_id, :moderation_reason])
  |> validate_required([:status, :moderated_at, :moderated_by_id])
  |> foreign_key_constraint(:moderated_by_id)
end
```

In `lib/live_canvas/content.ex`, add:

```elixir
@type post_moderation_result :: {:ok, PostSchema.t()} | {:error, changeset()}

@spec mark_post_removed(PostSchema.t(), User.t(), map()) :: post_moderation_result()
def mark_post_removed(%PostSchema{} = post, %User{id: moderator_id}, attrs)
    when is_integer(moderator_id) and is_map(attrs) do
  post
  |> Post.moderation_changeset(Post.moderation_removal_attrs(moderator_id, attrs))
  |> Repo.update()
end
```

This function does not grant authority by itself. Callers must use `LC.Accounts.staff?/1` through the moderation workflow before invoking it.

**Step 5: Hide removed posts in feed visibility**

Update both viewer and anonymous post visibility in `lib/live_canvas/feed.ex`:

```elixir
post.status == :active and
```

For the query pipeline, add:

```elixir
|> where([read_policy_resource: post], post.status == :active)
```

before kind/story expiry filtering. This keeps home/profile/top-level/Relay reads aligned.

**Step 6: Run focused verification**

Run:

```bash
mix test test/live_canvas/content_test.exs test/live_canvas/feed_test.exs test/live_canvas_gql/feed/feed_queries_test.exs test/live_canvas_gql/relay/node_queries_test.exs
mix compile
mix typecheck
```

Expected: PASS.

**Step 7: Commit the post moderation read model**

Run:

```bash
git add priv/repo/migrations/20260424131000_add_post_moderation_state.exs lib/live_canvas_schemas/content.ex lib/live_canvas_schemas/content/post.ex lib/live_canvas/content/post.ex lib/live_canvas/content.ex lib/live_canvas/feed.ex test/live_canvas/content_test.exs test/live_canvas/feed_test.exs test/live_canvas_gql/feed/feed_queries_test.exs test/live_canvas_gql/relay/node_queries_test.exs
git commit -m "feat: hide moderated posts"
```

### Task 3: Add The Moderation Context Report-Review Workflow

**Files:**
- Create: `priv/repo/migrations/20260424132000_add_post_report_review_fields.exs`
- Create: `lib/live_canvas/moderation.ex`
- Modify: `lib/live_canvas.ex`
- Modify: `lib/live_canvas_schemas/content/post_report.ex`
- Modify: `lib/live_canvas/content/post_report.ex`
- Modify: `test/live_canvas/moderation_test.exs`

**Step 1: Write failing moderation workflow tests**

Create `test/live_canvas/moderation_test.exs` with coverage for:

- non-staff users cannot list or review reports
- moderators can list open reports ordered by `inserted_at` then `id`
- dismissing an open report sets `status: :dismissed`, `reviewed_by_id`, `reviewed_at`, and `resolution_note`
- removing a post sets report `status: :actioned` and post `status: :removed` in one transaction
- reviewing an already reviewed report returns `{:error, :already_reviewed}`

Example first test:

```elixir
test "review_post_report/3 denies non-staff actors" do
  author = user_fixture()
  reporter = user_fixture()
  actor = user_fixture()
  {:ok, post} = Content.create_post(author, %{kind: :standard, body_text: "reported", visibility: :public})
  {:ok, report} = Content.report_post(reporter, post, %{reason: :spam})

  assert {:error, :not_authorized} =
           Moderation.review_post_report(actor, report.id, %{action: :dismiss})
end
```

**Step 2: Run tests to verify they fail**

Run:

```bash
mix test test/live_canvas/moderation_test.exs
```

Expected: FAIL because `LC.Moderation` and review fields do not exist.

**Step 3: Add post report review fields**

Create `priv/repo/migrations/20260424132000_add_post_report_review_fields.exs`:

```elixir
defmodule LiveCanvas.Repo.Migrations.AddPostReportReviewFields do
  use Ecto.Migration
  # Keep the legacy migration module namespace for historical migration identity.

  def change do
    alter table(:post_reports) do
      add :reviewed_by_id, references(:users, on_delete: :nilify_all)
      add :reviewed_at, :utc_datetime_usec
      add :resolution_note, :text
    end

    create index(:post_reports, [:reviewed_by_id])
    create index(:post_reports, [:status, :reviewed_at])
  end
end
```

Update `lib/live_canvas_schemas/content/post_report.ex` type and schema:

```elixir
reviewed_by_id: pos_integer() | nil,
reviewed_by: User.t() | Ecto.Association.NotLoaded.t(),
reviewed_at: DateTime.t() | nil,
resolution_note: String.t() | nil,
```

```elixir
field :reviewed_at, :utc_datetime_usec
field :resolution_note, :string
belongs_to :reviewed_by, User
```

In `lib/live_canvas/content/post_report.ex`, add a review changeset:

```elixir
@type review_attrs :: %{
        optional(:reviewed_at | :reviewed_by_id | :resolution_note | :status | String.t()) => term()
      }

@spec review_changeset(PostReportSchema.t(), review_attrs()) :: Ecto.Changeset.t()
def review_changeset(%PostReportSchema{} = report, attrs) when is_map(attrs) do
  report
  |> cast(attrs, [:status, :reviewed_by_id, :reviewed_at, :resolution_note])
  |> validate_required([:status, :reviewed_by_id, :reviewed_at])
  |> foreign_key_constraint(:reviewed_by_id)
end
```

**Step 4: Implement `LC.Moderation`**

Create `lib/live_canvas/moderation.ex`:

```elixir
defmodule LC.Moderation do
  @moduledoc """
  Staff-scoped moderation workflows.
  """

  use Boundary, deps: [LC.Accounts, LC.Content, LC.Infra, LCSchemas]
  import Ecto.Query, warn: false

  alias LC.{Accounts, Content}
  alias LC.Content.PostReport, as: PostReportChanges
  alias LC.Infra.Repo
  alias LCSchemas.Accounts.User
  alias LCSchemas.Content.PostReport

  @type review_action :: :dismiss | :remove_post
  @type review_attrs :: %{optional(:action | :resolution_note | String.t()) => term()}
  @type queue_result :: {:ok, Ecto.Query.t()} | {:error, :not_authorized}
  @type review_result ::
          {:ok, PostReport.t()}
          | {:error,
             :already_reviewed | :invalid_action | :not_authorized | :not_found | Ecto.Changeset.t()}

  @spec post_report_queue_query(User.t(), LCSchemas.Content.post_report_status()) :: queue_result()
  def post_report_queue_query(%User{} = actor, status \\ :open) do
    if Accounts.staff?(actor) and status in [:open, :reviewed, :dismissed, :actioned] do
      query =
        from(report in PostReport,
          where: report.status == ^status,
          order_by: [asc: report.inserted_at, asc: report.id],
          preload: [:post, :reporter, :reviewed_by]
        )

      {:ok, query}
    else
      {:error, :not_authorized}
    end
  end

  @spec get_staff_post_report(User.t(), pos_integer()) :: PostReport.t() | nil
  def get_staff_post_report(%User{} = actor, report_id)
      when is_integer(report_id) and report_id > 0 do
    if Accounts.staff?(actor) do
      Repo.get(PostReport, report_id)
    end
  end

  def get_staff_post_report(%User{}, _report_id), do: nil

  @spec review_post_report(User.t(), pos_integer(), review_attrs()) :: review_result()
  def review_post_report(%User{} = actor, report_id, attrs)
      when is_integer(report_id) and report_id > 0 and is_map(attrs) do
    with true <- Accounts.staff?(actor),
         {:ok, action} <- action(attrs) do
      Repo.transaction(fn ->
        report = report_for_update(report_id)

        case {report, action} do
          {nil, _action} ->
            Repo.rollback(:not_found)

          {%PostReport{status: status}, _action} when status != :open ->
            Repo.rollback(:already_reviewed)

          {%PostReport{} = report, :dismiss} ->
            review_report!(report, actor, :dismissed, attrs)

          {%PostReport{post: post} = report, :remove_post} ->
            with {:ok, _post} <- Content.mark_post_removed(post, actor, post_removal_attrs(attrs)) do
              review_report!(report, actor, :actioned, attrs)
            else
              {:error, reason} -> Repo.rollback(reason)
            end
        end
      end)
      |> normalize_transaction_result()
    else
      false -> {:error, :not_authorized}
      {:error, :invalid_action} -> {:error, :invalid_action}
    end
  end

  def review_post_report(%User{}, _report_id, _attrs), do: {:error, :not_found}

  @spec action(review_attrs()) :: {:ok, review_action()} | {:error, :invalid_action}
  defp action(attrs) when is_map(attrs) do
    case Map.get(attrs, :action) || Map.get(attrs, "action") do
      action when action in [:dismiss, :remove_post] -> {:ok, action}
      "dismiss" -> {:ok, :dismiss}
      "remove_post" -> {:ok, :remove_post}
      _other -> {:error, :invalid_action}
    end
  end

  @spec report_for_update(pos_integer()) :: PostReport.t() | nil
  defp report_for_update(report_id) when is_integer(report_id) and report_id > 0 do
    from(report in PostReport,
      where: report.id == ^report_id,
      preload: [:post],
      lock: "FOR UPDATE"
    )
    |> Repo.one()
  end

  @spec review_report!(
          PostReport.t(),
          User.t(),
          :actioned | :dismissed,
          review_attrs()
        ) :: PostReport.t()
  defp review_report!(%PostReport{} = report, %User{id: reviewer_id}, status, attrs)
       when is_integer(reviewer_id) and status in [:actioned, :dismissed] do
    review_attrs = %{
      status: status,
      reviewed_by_id: reviewer_id,
      reviewed_at: now_utc(),
      resolution_note: resolution_note(attrs)
    }

    report
    |> PostReportChanges.review_changeset(review_attrs)
    |> Repo.update!()
  end

  @spec post_removal_attrs(review_attrs()) :: %{optional(:moderation_reason) => String.t() | nil}
  defp post_removal_attrs(attrs) when is_map(attrs) do
    case resolution_note(attrs) do
      nil -> %{}
      note -> %{moderation_reason: note}
    end
  end

  @spec resolution_note(review_attrs()) :: String.t() | nil
  defp resolution_note(attrs) when is_map(attrs) do
    Map.get(attrs, :resolution_note) || Map.get(attrs, "resolution_note")
  end

  @spec normalize_transaction_result({:ok, PostReport.t()} | {:error, term()}) :: review_result()
  defp normalize_transaction_result({:ok, %PostReport{} = report}), do: {:ok, report}
  defp normalize_transaction_result({:error, %Ecto.Changeset{} = changeset}), do: {:error, changeset}
  defp normalize_transaction_result({:error, reason}), do: {:error, reason}

  @spec now_utc() :: DateTime.t()
  defp now_utc do
    DateTime.utc_now() |> DateTime.truncate(:microsecond)
  end
end
```

Keep the helper functions small and typed. If `mix typecheck` flags the direct `Repo.update!()` return type, narrow the changeset type with pattern matching rather than weakening the public spec.

Update `lib/live_canvas.ex` exports:

```elixir
exports: [Accounts, Chat, Content, Feed, Live, Moderation, RateLimiter, Social] ++ @test_support_exports
```

**Step 5: Run focused verification**

Run:

```bash
mix test test/live_canvas/moderation_test.exs test/live_canvas/content_test.exs test/live_canvas/feed_test.exs
mix compile
mix typecheck
```

Expected: PASS.

**Step 6: Commit the moderation workflow**

Run:

```bash
git add priv/repo/migrations/20260424132000_add_post_report_review_fields.exs lib/live_canvas/moderation.ex lib/live_canvas.ex lib/live_canvas_schemas/content/post_report.ex lib/live_canvas/content/post_report.ex test/live_canvas/moderation_test.exs
git commit -m "feat: add post report review workflow"
```

### Task 4: Expose Staff-Scoped Report Review Through Relay GraphQL

**Files:**
- Modify: `lib/live_canvas_gql/schema.ex`
- Modify: `lib/live_canvas_gql/content/content_queries.ex`
- Modify: `lib/live_canvas_gql/content/content_mutations.ex`
- Modify: `lib/live_canvas_gql/content/content_resolver.ex`
- Modify: `lib/live_canvas_gql/content/content_types.ex`
- Modify: `lib/live_canvas_web/plugs/graphql_mutation_rate_limit.ex`
- Modify: `test/live_canvas_gql/content/content_queries_test.exs`
- Modify: `test/live_canvas_gql/content/content_mutations_test.exs`
- Modify: `test/live_canvas_gql/relay/node_queries_test.exs`
- Modify: `test/live_canvas_gql/relay/graphql_rate_limit_test.exs`

**Step 1: Write failing GraphQL tests**

Add tests for:

- `postReportQueue(first:)` returns only open reports to staff and returns an empty connection for non-staff.
- `reviewPostReport(input: {reportId, action: DISMISS})` dismisses an open report for staff.
- `reviewPostReport(input: {reportId, action: REMOVE_POST})` action-marks the report and removes the post from `homeFeed`/`node(id:)`.
- `reviewPostReport` returns stable payload errors for unauthenticated, non-staff, invalid ID/type, not found, already reviewed, and invalid action cases.
- staff can refetch a `PostReport` through Relay `node(id:)`, while unrelated non-staff users still cannot.
- `reviewPostReport` is classified under the moderation-action rate-limit bucket.

**Step 2: Run tests to verify they fail**

Run:

```bash
mix test test/live_canvas_gql/content/content_queries_test.exs test/live_canvas_gql/content/content_mutations_test.exs test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/relay/graphql_rate_limit_test.exs
```

Expected: FAIL because queue/review GraphQL fields and staff node refetch are missing.

**Step 3: Add GraphQL types and fields**

In `lib/live_canvas_gql/content/content_types.ex`, add:

```elixir
connection(node_type: :post_report)

enum :post_report_review_action do
  value(:dismiss)
  value(:remove_post)
end
```

Extend `node object(:post_report)`:

```elixir
field :reviewed_by_id, :id do
  resolve(&Resolver.post_report_reviewed_by_id/3)
end

field :reviewed_at, :string
field :resolution_note, :string
```

In `lib/live_canvas_gql/content/content_queries.ex`:

```elixir
connection field :post_report_queue, node_type: :post_report, paginate: :forward do
  arg(:status, :post_report_status)
  resolve(&Resolver.post_report_queue/3)
end
```

In `lib/live_canvas_gql/content/content_mutations.ex`:

```elixir
payload field :review_post_report do
  input do
    field :report_id, non_null(:id)
    field :action, non_null(:post_report_review_action)
    field :resolution_note, :string
  end

  output do
    field :report, :post_report
    field :errors, non_null(list_of(non_null(:content_error)))
  end

  resolve(&Resolver.review_post_report/3)
end
```

**Step 4: Implement resolver wiring**

In `lib/live_canvas_gql/content/content_resolver.ex`:

- Alias `LC.Moderation`.
- Add `post_report_queue/3` that calls `Moderation.post_report_queue_query(viewer, status || :open)` and returns `Absinthe.Relay.Connection.from_query(query, &Content.run_query/1, args)` or an empty connection on authorization failure.
- Add `review_post_report/3` that decodes `report_id` as `:post_report`, calls `Moderation.review_post_report/3`, and maps errors to the existing `content_error` payload shape.
- Add `post_report_reviewed_by_id/3` mirroring the existing reporter/post ID helpers.
- Keep error fields camel-cased for invalid IDs (`"reportId"`), and use stable messages: `unauthenticated`, `not_authorized`, `not_found`, `already_reviewed`, `invalid_action`, `invalid_id`, `invalid_type`.

If `LC.Content` lacks a generic `run_query/1`, add:

```elixir
@doc false
@spec run_query(Ecto.Query.t()) :: [term()]
def run_query(query), do: Repo.all(query)
```

**Step 5: Update Relay node authorization**

In `lib/live_canvas_gql/schema.ex`, alias `LC.Moderation` and update `fetch_post_report_node/2`:

```elixir
case Ecto.Type.cast(:id, id) do
  {:ok, local_id} when is_integer(local_id) and local_id > 0 ->
    {:ok, Content.get_user_post_report(viewer, local_id) || Moderation.get_staff_post_report(viewer, local_id)}

  _ ->
    {:ok, nil}
end
```

This preserves reporter-owned refetch and adds fresh staff-gated refetch without exposing report IDs to unrelated users.

**Step 6: Classify review mutation as a moderation action**

In `lib/live_canvas_web/plugs/graphql_mutation_rate_limit.ex`, add `"reviewPostReport"` to `moderation_mutation_names/0`.

**Step 7: Run focused verification**

Run:

```bash
mix test test/live_canvas_gql/content/content_queries_test.exs test/live_canvas_gql/content/content_mutations_test.exs test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/relay/graphql_rate_limit_test.exs
mix compile
mix typecheck
```

Expected: PASS.

**Step 8: Commit the GraphQL review surface**

Run:

```bash
git add lib/live_canvas_gql/schema.ex lib/live_canvas_gql/content/content_queries.ex lib/live_canvas_gql/content/content_mutations.ex lib/live_canvas_gql/content/content_resolver.ex lib/live_canvas_gql/content/content_types.ex lib/live_canvas_web/plugs/graphql_mutation_rate_limit.ex test/live_canvas_gql/content/content_queries_test.exs test/live_canvas_gql/content/content_mutations_test.exs test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/relay/graphql_rate_limit_test.exs
git commit -m "feat: expose post report review api"
```

### Task 5: Refresh Backend Planning Docs And Report Shared Contract Updates

**Files:**
- Modify: `docs/plans/content/2026-04-24-post-report-review-and-actioning.md`
- Modify: `docs/plans/backend/NOW.md`

**Step 1: Run final focused verification for this plan**

Run:

```bash
mix test test/live_canvas/accounts_test.exs test/live_canvas/content_test.exs test/live_canvas/feed_test.exs test/live_canvas/moderation_test.exs test/live_canvas_gql/content/content_queries_test.exs test/live_canvas_gql/content/content_mutations_test.exs test/live_canvas_gql/feed/feed_queries_test.exs test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/relay/graphql_rate_limit_test.exs
mix compile
mix typecheck
```

Expected: PASS.

**Step 2: Update plan progress**

Mark Tasks 1-5 complete in this plan and add verification outcomes with exact command output summaries.

**Step 3: Advance backend lane tracking**

Update `docs/plans/backend/NOW.md` to either:

- the next unblocked backend batch if one is selected, or
- active planning with a clear "create next detailed backend implementation plan" batch if this plan closes the current backend product gap.

Do not edit `docs/plans/NOW.md` or `docs/plans/INDEX.md` from this backend lane. Report required shared dashboard/index repairs instead.

**Step 4: Report shared contract updates**

Report, but do not edit unless explicitly assigned, that shared client contract docs should document:

- `postReportQueue`
- `reviewPostReport`
- staff-only `PostReport` node refetch
- post removal visibility semantics
- role provisioning expectations for moderator/admin users

**Step 5: Commit the planning refresh**

Run:

```bash
git add docs/plans/content/2026-04-24-post-report-review-and-actioning.md docs/plans/backend/NOW.md
git commit -m "docs: refresh post report review tracking"
```
