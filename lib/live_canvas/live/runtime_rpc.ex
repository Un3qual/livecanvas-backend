defmodule LC.Live.RuntimeRPC do
  @moduledoc false

  @typedoc "Normalized transport-level failure reasons for remote runtime calls."
  @type error_reason :: :remote_not_found | :remote_timeout | :remote_unreachable
  @type call_result :: {:ok, term()} | {:error, error_reason()}

  @callback call(String.t(), module(), atom(), [term()], keyword()) :: call_result()

  @spec call(String.t(), module(), atom(), [term()], keyword()) :: call_result()
  def call(owner_node, module, function, args, opts \\ [])
      when is_binary(owner_node) and is_atom(module) and is_atom(function) and is_list(args) and
             is_list(opts) do
    timeout = Keyword.get(opts, :timeout, 5_000)

    with {:ok, node_name} <- resolve_node_name(owner_node) do
      try do
        {:ok, :erpc.call(node_name, module, function, args, timeout)}
      catch
        :exit, reason ->
          {:error, normalize_transport_error(reason)}
      end
    end
  end

  @spec resolve_node_name(String.t()) :: {:ok, node()} | {:error, :remote_unreachable}
  defp resolve_node_name(owner_node) when is_binary(owner_node) do
    known_nodes = [Node.self() | Node.list()]

    case Enum.find(known_nodes, fn node_name -> Atom.to_string(node_name) == owner_node end) do
      nil -> {:error, :remote_unreachable}
      node_name -> {:ok, node_name}
    end
  end

  @spec normalize_transport_error(term()) :: error_reason()
  defp normalize_transport_error({:erpc, :noconnection}), do: :remote_unreachable
  defp normalize_transport_error({:erpc, :timeout}), do: :remote_timeout
  defp normalize_transport_error({:timeout, _context}), do: :remote_timeout
  defp normalize_transport_error({:erpc, :undef}), do: :remote_not_found
  defp normalize_transport_error({:erpc, :noproc}), do: :remote_not_found

  defp normalize_transport_error({:erpc, {:exception, %UndefinedFunctionError{}}}),
    do: :remote_not_found

  defp normalize_transport_error({:erpc, {:exception, %ErlangError{original: :undef}}}),
    do: :remote_not_found

  defp normalize_transport_error(_reason), do: :remote_unreachable
end
