defmodule LiveCanvas.Repo.Migrations.FinalizeEntropyIdIndexes do
  use Ecto.Migration
  # Concurrent index operations cannot run inside Ecto's migration transaction.
  @disable_ddl_transaction true
  @disable_migration_lock true
  # Keep the legacy migration module namespace for historical migration identity.

  @relational_tables [
    {:users, :users_entropy_id_index},
    {:email_addresses, :email_addresses_entropy_id_index},
    {:phone_numbers, :phone_numbers_entropy_id_index},
    {:user_email_addresses, :user_email_addresses_entropy_id_index},
    {:user_phone_numbers, :user_phone_numbers_entropy_id_index},
    {:user_identities, :user_identities_entropy_id_index},
    {:user_contact_entries, :user_contact_entries_entropy_id_index},
    {:user_contact_entry_email_addresses, :user_contact_entry_email_addresses_entropy_id_index},
    {:user_contact_entry_phone_numbers, :user_contact_entry_phone_numbers_entropy_id_index}
  ]

  def up do
    Enum.each(@relational_tables, fn {table_name, index_name} ->
      create(
        unique_index(table_name, [:entropy_id],
          name: index_name,
          concurrently: true
        )
      )
    end)

    Enum.each(@relational_tables, fn {table_name, _index_name} ->
      execute("ALTER TABLE #{table_name} ALTER COLUMN entropy_id SET NOT NULL")
    end)
  end

  def down do
    Enum.each(@relational_tables, fn {table_name, _index_name} ->
      execute("ALTER TABLE #{table_name} ALTER COLUMN entropy_id DROP NOT NULL")
    end)

    Enum.each(@relational_tables, fn {table_name, index_name} ->
      drop_if_exists(index(table_name, [:entropy_id], name: index_name, concurrently: true))
    end)
  end
end
