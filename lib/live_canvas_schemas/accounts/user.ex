defmodule LCSchemas.Accounts.User do
  use LCSchemas.Schema, :relational

  alias LCSchemas.Accounts.{
    EmailAddress,
    PhoneNumber,
    UserContactEntry,
    UserEmailAddress,
    UserIdentity,
    UserPhoneNumber
  }

  @type t :: %__MODULE__{
          id: pos_integer() | nil,
          entropy_id: Ecto.UUID.t() | nil,
          email: String.t() | nil,
          password: String.t() | nil,
          hashed_password: String.t() | nil,
          confirmed_at: DateTime.t() | nil,
          privacy_mode: LCSchemas.Accounts.user_privacy_mode() | nil,
          role: LCSchemas.Accounts.user_role() | nil,
          suspended_at: DateTime.t() | nil,
          authenticated_at: DateTime.t() | nil,
          user_email_addresses: Ecto.Association.NotLoaded.t() | [UserEmailAddress.t()],
          email_addresses: Ecto.Association.NotLoaded.t() | [EmailAddress.t()],
          user_phone_numbers: Ecto.Association.NotLoaded.t() | [UserPhoneNumber.t()],
          phone_numbers: Ecto.Association.NotLoaded.t() | [PhoneNumber.t()],
          user_identities: Ecto.Association.NotLoaded.t() | [UserIdentity.t()],
          user_contact_entries: Ecto.Association.NotLoaded.t() | [UserContactEntry.t()],
          inserted_at: DateTime.t() | nil,
          updated_at: DateTime.t() | nil
        }

  schema "users" do
    field :entropy_id, Ecto.UUID, read_after_writes: true
    field :email, :string, virtual: true
    field :password, :string, virtual: true, redact: true
    field :hashed_password, :string, redact: true
    field :confirmed_at, :utc_datetime_usec
    field :privacy_mode, LCSchemas.Accounts.UserPrivacyMode, default: :private
    field :role, LCSchemas.Accounts.UserRole, default: :user
    field :suspended_at, :utc_datetime_usec
    field :authenticated_at, :utc_datetime_usec, virtual: true

    has_many :user_email_addresses, LCSchemas.Accounts.UserEmailAddress
    has_many :email_addresses, through: [:user_email_addresses, :email_address]
    has_many :user_phone_numbers, LCSchemas.Accounts.UserPhoneNumber
    has_many :phone_numbers, through: [:user_phone_numbers, :phone_number]
    has_many :user_identities, LCSchemas.Accounts.UserIdentity
    has_many :user_contact_entries, LCSchemas.Accounts.UserContactEntry

    timestamps()
  end
end
