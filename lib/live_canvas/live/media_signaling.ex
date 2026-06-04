defmodule LC.Live.MediaSignaling do
  @moduledoc """
  Pure boundary for mobile live media signaling setup and payload validation.
  """

  @offer_event "media:offer"
  @answer_event "media:answer"
  @ice_candidate_event "media:ice_candidate"
  @default_ice_servers [%{urls: ["stun:stun.l.google.com:19302"]}]
  @max_sdp_bytes 64 * 1024
  @max_ice_candidate_bytes 4 * 1024

  @type provider_config :: keyword()
  @type ice_server_result :: {:ok, [ice_server()]} | {:error, term()}
  @type credential_type :: :password | :oauth
  @type ice_server :: %{
          required(:urls) => [String.t()],
          optional(:username) => String.t(),
          optional(:credential) => String.t(),
          optional(:credential_type) => credential_type()
        }
  @type media_events :: %{
          required(:offer) => String.t(),
          required(:answer) => String.t(),
          required(:ice_candidate) => String.t()
        }
  @type prepare_payload :: %{
          required(:ice_servers) => [ice_server()],
          required(:events) => media_events()
        }
  @type description_type :: :offer | :answer
  @type description_payload :: %{
          required(:type) => description_type(),
          required(:sdp) => String.t()
        }
  @type ice_candidate_payload :: %{
          required(:candidate) => String.t(),
          optional(:sdp_mid) => String.t(),
          optional(:sdp_m_line_index) => non_neg_integer(),
          optional(:username_fragment) => String.t()
        }
  @type validation_reason :: :required | :invalid | :too_large
  @type validation_error :: %{
          required(:field) => String.t(),
          required(:reason) => validation_reason()
        }
  @type validation_result(payload) :: {:ok, payload} | {:error, [validation_error()]}
  @type media_payload :: description_payload() | ice_candidate_payload()

  @callback ice_servers(provider_config()) :: ice_server_result()

  @spec prepare_live_media_session(provider_config()) :: prepare_payload()
  def prepare_live_media_session(opts \\ []) when is_list(opts) do
    %{
      ice_servers: ice_servers(opts),
      events: media_events()
    }
  end

  @spec ice_servers(provider_config()) :: [ice_server()]
  def ice_servers(opts \\ []) when is_list(opts) do
    provider = Keyword.get(opts, :provider, configured_provider())
    provider_config = Keyword.get(opts, :provider_config, configured_provider_config())

    case provider.ice_servers(provider_config) do
      {:ok, ice_servers} when is_list(ice_servers) ->
        ice_servers

      {:error, reason} ->
        raise ArgumentError, "live media ICE server provider failed: #{inspect(reason)}"
    end
  end

  @spec media_events() :: media_events()
  def media_events do
    %{
      offer: @offer_event,
      answer: @answer_event,
      ice_candidate: @ice_candidate_event
    }
  end

  @spec validate_offer_payload(term()) :: validation_result(description_payload())
  def validate_offer_payload(payload), do: validate_description_payload(payload, :offer)

  @spec validate_answer_payload(term()) :: validation_result(description_payload())
  def validate_answer_payload(payload), do: validate_description_payload(payload, :answer)

  @spec validate_ice_candidate_payload(term()) :: validation_result(ice_candidate_payload())
  def validate_ice_candidate_payload(payload) when is_map(payload) do
    candidate = value_for(payload, :candidate)
    sdp_mid = value_for(payload, :sdp_mid)
    sdp_m_line_index = value_for(payload, :sdp_m_line_index)
    username_fragment = value_for(payload, :username_fragment)

    errors =
      []
      |> append_required_string_error("candidate", candidate, @max_ice_candidate_bytes)
      |> append_optional_non_neg_integer_error("sdp_m_line_index", sdp_m_line_index)
      |> append_optional_string_error("sdp_mid", sdp_mid, @max_ice_candidate_bytes)
      |> append_optional_string_error(
        "username_fragment",
        username_fragment,
        @max_ice_candidate_bytes
      )
      |> Enum.reverse()

    case errors do
      [] ->
        {:ok,
         %{
           candidate: candidate,
           sdp_mid: sdp_mid,
           sdp_m_line_index: sdp_m_line_index,
           username_fragment: username_fragment
         }
         |> reject_nil_values()}

      validation_errors ->
        {:error, validation_errors}
    end
  end

  def validate_ice_candidate_payload(_payload),
    do: {:error, [%{field: "candidate", reason: :required}]}

  @spec validate_event_payload(String.t(), term()) ::
          validation_result(media_payload()) | {:error, :unknown_event}
  def validate_event_payload(@offer_event, payload), do: validate_offer_payload(payload)
  def validate_event_payload(@answer_event, payload), do: validate_answer_payload(payload)

  def validate_event_payload(@ice_candidate_event, payload),
    do: validate_ice_candidate_payload(payload)

  def validate_event_payload(_event, _payload), do: {:error, :unknown_event}

  @spec validate_description_payload(term(), description_type()) ::
          validation_result(description_payload())
  defp validate_description_payload(payload, expected_type) when is_map(payload) do
    type = value_for(payload, :type)
    sdp = value_for(payload, :sdp)

    errors =
      []
      |> append_description_type_error(expected_type, type)
      |> append_required_string_error("sdp", sdp, @max_sdp_bytes)
      |> Enum.reverse()

    case errors do
      [] -> {:ok, %{type: expected_type, sdp: sdp}}
      validation_errors -> {:error, validation_errors}
    end
  end

  defp validate_description_payload(_payload, _expected_type),
    do: {:error, [%{field: "type", reason: :required}, %{field: "sdp", reason: :required}]}

  @spec append_description_type_error([validation_error()], description_type(), term()) ::
          [validation_error()]
  defp append_description_type_error(errors, expected_type, type) do
    cond do
      missing_string?(type) ->
        [%{field: "type", reason: :required} | errors]

      description_type_matches?(type, expected_type) ->
        errors

      true ->
        [%{field: "type", reason: :invalid} | errors]
    end
  end

  defp append_required_string_error(errors, field, value, max_bytes) do
    cond do
      missing_string?(value) -> [%{field: field, reason: :required} | errors]
      not is_binary(value) -> [%{field: field, reason: :invalid} | errors]
      byte_size(value) > max_bytes -> [%{field: field, reason: :too_large} | errors]
      true -> errors
    end
  end

  defp append_optional_string_error(errors, _field, nil, _max_bytes), do: errors

  defp append_optional_string_error(errors, field, value, _max_bytes) when not is_binary(value),
    do: [%{field: field, reason: :invalid} | errors]

  defp append_optional_string_error(errors, field, value, max_bytes) do
    cond do
      String.trim(value) == "" -> [%{field: field, reason: :invalid} | errors]
      byte_size(value) > max_bytes -> [%{field: field, reason: :too_large} | errors]
      true -> errors
    end
  end

  @spec append_optional_non_neg_integer_error([validation_error()], String.t(), term()) ::
          [validation_error()]
  defp append_optional_non_neg_integer_error(errors, _field, nil), do: errors

  defp append_optional_non_neg_integer_error(errors, field, value) do
    if is_integer(value) and value >= 0 do
      errors
    else
      [%{field: field, reason: :invalid} | errors]
    end
  end

  @spec description_type_matches?(term(), description_type()) :: boolean()
  defp description_type_matches?(:offer, :offer), do: true
  defp description_type_matches?("offer", :offer), do: true
  defp description_type_matches?(:answer, :answer), do: true
  defp description_type_matches?("answer", :answer), do: true
  defp description_type_matches?(_type, _expected_type), do: false

  @spec missing_string?(term()) :: boolean()
  defp missing_string?(nil), do: true
  defp missing_string?(value) when is_binary(value), do: String.trim(value) == ""
  defp missing_string?(_value), do: false

  # Phoenix channel payloads arrive with string keys, while internal tests and
  # callers may use atom keys. Keep both forms supported at this boundary.
  defp value_for(payload, key) when is_atom(key) do
    case Map.fetch(payload, key) do
      {:ok, value} -> value
      :error -> Map.get(payload, Atom.to_string(key))
    end
  end

  defp reject_nil_values(payload) do
    Map.reject(payload, fn {_key, value} -> is_nil(value) end)
  end

  @spec configured_provider() :: module()
  defp configured_provider do
    config()
    |> Keyword.get(:provider, __MODULE__.StaticIceServerProvider)
  end

  @spec configured_provider_config() :: provider_config()
  defp configured_provider_config do
    config()
    |> Keyword.get(:provider_config, ice_servers: @default_ice_servers)
  end

  @spec config() :: keyword()
  defp config do
    Application.get_env(:live_canvas, __MODULE__, [])
  end
end

defmodule LC.Live.MediaSignaling.StaticIceServerProvider do
  @moduledoc false

  @behaviour LC.Live.MediaSignaling

  @impl LC.Live.MediaSignaling
  @spec ice_servers(LC.Live.MediaSignaling.provider_config()) ::
          LC.Live.MediaSignaling.ice_server_result()
  def ice_servers(opts) when is_list(opts) do
    case Keyword.fetch(opts, :ice_servers) do
      {:ok, ice_servers} when is_list(ice_servers) -> {:ok, ice_servers}
      _other -> {:error, :invalid_ice_server_config}
    end
  end
end
