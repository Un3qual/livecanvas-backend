defmodule LC.Live.MediaSignaling do
  @moduledoc """
  Pure boundary for mobile live media signaling setup and payload validation.
  """

  @offer_event "media:offer"
  @answer_event "media:answer"
  @ice_candidate_event "media:ice_candidate"
  @default_ice_servers [%{urls: ["stun:stun.l.google.com:19302"]}]

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
  @type validation_reason :: :required | :invalid
  @type validation_error :: %{
          required(:field) => String.t(),
          required(:reason) => validation_reason()
        }
  @type validation_result(payload) :: {:ok, payload} | {:error, [validation_error()]}
  @type media_payload :: description_payload() | ice_candidate_payload()

  @spec prepare_live_media_session() :: prepare_payload()
  def prepare_live_media_session do
    %{
      ice_servers: ice_servers(),
      events: media_events()
    }
  end

  @spec ice_servers() :: [ice_server()]
  def ice_servers, do: @default_ice_servers

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
      |> append_required_string_error("candidate", candidate)
      |> append_optional_non_neg_integer_error("sdp_m_line_index", sdp_m_line_index)
      |> append_optional_string_error("sdp_mid", sdp_mid)
      |> append_optional_string_error("username_fragment", username_fragment)
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
      |> append_required_string_error("sdp", sdp)
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

  @spec append_required_string_error([validation_error()], String.t(), term()) ::
          [validation_error()]
  defp append_required_string_error(errors, field, value) do
    cond do
      missing_string?(value) -> [%{field: field, reason: :required} | errors]
      is_binary(value) -> errors
      true -> [%{field: field, reason: :invalid} | errors]
    end
  end

  @spec append_optional_string_error([validation_error()], String.t(), term()) ::
          [validation_error()]
  defp append_optional_string_error(errors, _field, nil), do: errors

  defp append_optional_string_error(errors, field, value) do
    if is_binary(value), do: errors, else: [%{field: field, reason: :invalid} | errors]
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
  defp missing_string?(value), do: value == nil or value == ""

  defp value_for(payload, key) when is_atom(key) do
    case Map.fetch(payload, key) do
      {:ok, value} -> value
      :error -> Map.get(payload, Atom.to_string(key))
    end
  end

  defp reject_nil_values(payload) do
    Map.reject(payload, fn {_key, value} -> is_nil(value) end)
  end
end
