# Development Seeds

`mix ecto.setup` and `mix ecto.reset` run `priv/repo/seeds.exs` in `MIX_ENV=dev`, which calls `LC.Dev.SeedData.seed!/0`.

For day-to-day local resets, use:

```bash
mix ecto.reset
```

This recreates the database and reloads the deterministic development dataset.

## Shared Credentials

- Email: `dev-viewer@example.com`
- Email: `dev-creator@example.com`
- Email: `dev-host@example.com`
- Shared password: `dev-password-123`

## Seeded Dataset

- `dev-viewer@example.com`: Primary viewer account. Follows the creator and host accounts so local clients have immediate `following`, `homeFeed`, and `liveNow` data.
- `dev-creator@example.com`: Public creator profile with one public post and one followers-only post visible to the seeded viewer.
- `dev-host@example.com`: Public host profile with one public post and one active followers-only live session visible to the seeded viewer.

## Local Workflow

1. Run `mix ecto.reset`.
2. Start the backend with `mix phx.server`.
3. Sign in with one of the seeded accounts above.

The dataset is intentionally small and idempotent so rerunning the seed flow reuses the same seeded users, follow edges, posts, and live session fixture instead of duplicating them.
