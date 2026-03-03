defmodule LiveCanvasSchemas.Accounts.User do
  use LiveCanvasSchemas.Schema, :relational

  @type t :: %__MODULE__{
          id: pos_integer() | nil,
          entropy_id: Ecto.UUID.t() | nil,
          email: String.t() | nil,
          password: String.t() | nil,
          hashed_password: String.t() | nil,
          confirmed_at: DateTime.t() | nil,
          privacy_mode: atom() | nil,
          authenticated_at: DateTime.t() | nil,
          user_email_addresses: Ecto.Association.NotLoaded.t() | [struct()],
          email_addresses: Ecto.Association.NotLoaded.t() | [struct()],
          user_phone_numbers: Ecto.Association.NotLoaded.t() | [struct()],
          phone_numbers: Ecto.Association.NotLoaded.t() | [struct()],
          user_identities: Ecto.Association.NotLoaded.t() | [struct()],
          user_contact_entries: Ecto.Association.NotLoaded.t() | [struct()],
          inserted_at: DateTime.t() | nil,
          updated_at: DateTime.t() | nil
        }

  schema "users" do
    field :entropy_id, Ecto.UUID, read_after_writes: true
    field :email, :string, virtual: true
    field :password, :string, virtual: true, redact: true
    field :hashed_password, :string, redact: true
    field :confirmed_at, :utc_datetime_usec
    field :privacy_mode, LiveCanvasSchemas.Accounts.UserPrivacyMode, default: :private
    field :authenticated_at, :utc_datetime_usec, virtual: true

    has_many :user_email_addresses, LiveCanvasSchemas.Accounts.UserEmailAddress
    has_many :email_addresses, through: [:user_email_addresses, :email_address]
    has_many :user_phone_numbers, LiveCanvasSchemas.Accounts.UserPhoneNumber
    has_many :phone_numbers, through: [:user_phone_numbers, :phone_number]
    has_many :user_identities, LiveCanvasSchemas.Accounts.UserIdentity
    has_many :user_contact_entries, LiveCanvasSchemas.Accounts.UserContactEntry

    timestamps()
  end
end
