defmodule LiveCanvas.Repo.Migrations.AddEntropyIdsToExistingRelationalTables do
  use Ecto.Migration

  @relational_tables [
    :users,
    :email_addresses,
    :phone_numbers,
    :user_email_addresses,
    :user_phone_numbers,
    :user_identities,
    :user_contact_entries,
    :user_contact_entry_email_addresses,
    :user_contact_entry_phone_numbers
  ]

  def up do
    # Fail fast on environments that do not provide native uuidv7().
    ensure_uuidv7_available!()

    Enum.each(@relational_tables, fn table_name ->
      alter table(table_name) do
        add :entropy_id, :uuid
      end
    end)

    flush()

    Enum.each(@relational_tables, fn table_name ->
      # Backfill existing rows before making uuidv7() the default for new inserts.
      execute("UPDATE #{table_name} SET entropy_id = uuidv7() WHERE entropy_id IS NULL")
      execute("ALTER TABLE #{table_name} ALTER COLUMN entropy_id SET DEFAULT uuidv7()")
    end)

    # Keep UUID-primary-key exception tables on database-owned UUID generation.
    execute("ALTER TABLE users_tokens ALTER COLUMN id SET DEFAULT uuidv7()")
  end

  def down do
    execute("ALTER TABLE users_tokens ALTER COLUMN id SET DEFAULT gen_random_uuid()")

    Enum.each(Enum.reverse(@relational_tables), fn table_name ->
      alter table(table_name) do
        remove :entropy_id
      end
    end)
  end

  defp ensure_uuidv7_available! do
    execute("""
    DO $$
    BEGIN
      PERFORM uuidv7();
    EXCEPTION
      WHEN undefined_function THEN
        RAISE EXCEPTION 'uuidv7() is required for entropy_id migrations. PostgreSQL 18+ is required.';
    END
    $$;
    """)
  end
end
