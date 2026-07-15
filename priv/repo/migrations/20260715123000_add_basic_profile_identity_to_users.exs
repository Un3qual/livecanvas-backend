defmodule LC.Infra.Repo.Migrations.AddBasicProfileIdentityToUsers do
  use Ecto.Migration

  def change do
    alter table(:users) do
      add :username, :text
      add :display_name, :text
    end

    create unique_index(:users, [:username])

    create constraint(:users, :users_username_format_check,
             check:
               "username IS NULL OR (char_length(username) BETWEEN 3 AND 30 AND username ~ '^[a-z0-9][a-z0-9_]{1,28}[a-z0-9]$')"
           )

    create constraint(:users, :users_display_name_format_check,
             check:
               "display_name IS NULL OR (char_length(display_name) BETWEEN 1 AND 50 AND display_name !~ '(^[[:space:]])|([[:space:]]$)' AND display_name !~ '[[:cntrl:]]')"
           )
  end
end
