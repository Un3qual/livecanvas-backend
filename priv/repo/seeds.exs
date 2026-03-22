alias LC.Dev.SeedData

case Mix.env() do
  :dev ->
    summary = SeedData.seed!()

    Mix.shell().info("Seeded development accounts:")

    Enum.each(summary.users, fn user ->
      Mix.shell().info(
        "  #{user.key}: #{user.email} (privacy: #{user.privacy_mode}, id: #{user.user_id})"
      )
    end)

    Mix.shell().info("Shared password: #{summary.shared_password}")

  env ->
    Mix.shell().info(
      "Skipping LC.Dev.SeedData because Mix.env() is #{inspect(env)}. Development seeds run only in :dev."
    )
end
