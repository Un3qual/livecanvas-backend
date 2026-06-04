defmodule LCGQL.Live.Mutations do
  use Absinthe.Schema.Notation
  use Absinthe.Relay.Schema.Notation, :modern

  alias LCGQL.Live.Resolver

  object :live_mutations do
    payload field :start_live_session do
      input do
        field :visibility, :live_session_visibility
      end

      output do
        field :live_session, :live_session
        field :errors, non_null(list_of(non_null(:user_error)))
      end

      resolve(&Resolver.start_live_session/3)
    end

    payload field :go_live_session do
      input do
        field :live_session_id, non_null(:id)
      end

      output do
        field :live_session, :live_session
        field :errors, non_null(list_of(non_null(:user_error)))
      end

      resolve(&Resolver.go_live_session/3)
    end

    payload field :prepare_live_media_session do
      input do
        field :live_session_id, non_null(:id)
      end

      output do
        field :live_session, :live_session
        field :signaling_topic, :string
        field :ice_servers, non_null(list_of(non_null(:live_media_ice_server)))
        field :errors, non_null(list_of(non_null(:user_error)))
      end

      resolve(&Resolver.prepare_live_media_session/3)
    end

    payload field :join_live_session do
      input do
        field :live_session_id, non_null(:id)
      end

      output do
        field :live_session, :live_session
        field :errors, non_null(list_of(non_null(:user_error)))
      end

      resolve(&Resolver.join_live_session/3)
    end

    payload field :leave_live_session do
      input do
        field :live_session_id, non_null(:id)
      end

      output do
        field :left, non_null(:boolean)
        field :errors, non_null(list_of(non_null(:user_error)))
      end

      resolve(&Resolver.leave_live_session/3)
    end

    payload field :end_live_session do
      input do
        field :live_session_id, non_null(:id)
        field :recording_media_asset_id, :id
      end

      output do
        field :live_session, :live_session
        field :errors, non_null(list_of(non_null(:user_error)))
      end

      resolve(&Resolver.end_live_session/3)
    end
  end
end
