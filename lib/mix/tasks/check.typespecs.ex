defmodule Mix.Tasks.Check.Typespecs do
  use Mix.Task
  use Boundary, classify_to: LiveCanvas

  @shortdoc "Checks that public functions have @spec declarations"

  @moduledoc """
  Verifies that each public `def` in the given files has an immediately preceding `@spec`.

  Accepts paths directly or through `--manifest` (one path per line, repo-relative).
  """

  @switches [manifest: :string, strict: :boolean]

  @spec run([String.t()]) :: :ok | nil
  @impl Mix.Task
  def run(args) do
    {opts, paths, invalid} = OptionParser.parse(args, switches: @switches)

    if invalid != [] do
      Mix.raise("invalid options: #{inspect(invalid)}")
    end

    files = collect_files(paths, Keyword.get(opts, :manifest))

    missing_specs =
      files
      |> Enum.flat_map(&missing_specs_for_file/1)
      |> Enum.sort_by(&{&1.file, &1.line, &1.name, &1.arity})

    strict? = Keyword.get(opts, :strict, false)

    if missing_specs == [] do
      :ok
    else
      print_missing_specs(missing_specs)

      if strict? do
        Mix.raise("typespec check failed")
      end
    end
  end

  defp collect_files(paths, manifest_path) do
    manifest_paths =
      case manifest_path do
        nil -> []
        path -> read_manifest(path)
      end

    resolved_paths = paths ++ manifest_paths

    source_paths =
      if resolved_paths == [] do
        Path.wildcard("lib/**/*.ex")
      else
        resolved_paths
      end

    source_paths
    |> Enum.map(&String.trim/1)
    |> Enum.reject(&(&1 == ""))
    |> Enum.uniq()
  end

  defp read_manifest(path) do
    path
    |> File.read!()
    |> String.split(~r/\R/)
    |> Enum.map(&String.trim/1)
    |> Enum.reject(&(&1 == "" or String.starts_with?(&1, "#")))
  end

  defp missing_specs_for_file(file) do
    quoted =
      file
      |> File.read!()
      |> Code.string_to_quoted!(file: file)

    quoted
    |> module_bodies()
    |> Enum.flat_map(&missing_specs_in_module_forms(&1, file))
  end

  defp module_bodies(quoted) do
    {_quoted, bodies} =
      Macro.prewalk(quoted, [], fn
        {:defmodule, _meta, [_name_ast, [do: body_ast]]} = node, acc ->
          {node, [block_to_list(body_ast) | acc]}

        node, acc ->
          {node, acc}
      end)

    Enum.reverse(bodies)
  end

  defp block_to_list({:__block__, _meta, forms}) when is_list(forms), do: forms
  defp block_to_list(nil), do: []
  defp block_to_list(form), do: [form]

  defp missing_specs_in_module_forms(forms, file) do
    {_specified, _pending_specs, missing} =
      Enum.reduce(forms, {MapSet.new(), MapSet.new(), []}, fn form,
                                                              {specified, pending_specs, missing} ->
        case extract_spec_signature(form) do
          nil ->
            case extract_def_signature(form) do
              nil ->
                {specified, pending_specs, missing}

              {name, arity, line} ->
                key = {name, arity}

                cond do
                  MapSet.member?(pending_specs, key) ->
                    {MapSet.put(specified, key), MapSet.new(), missing}

                  # Multi-clause functions are satisfied once the first clause has a spec.
                  MapSet.member?(specified, key) ->
                    {specified, MapSet.new(), missing}

                  true ->
                    entry = %{file: file, line: line, name: name, arity: arity}
                    {specified, MapSet.new(), [entry | missing]}
                end
            end

          spec_key ->
            {specified, MapSet.put(pending_specs, spec_key), missing}
        end
      end)

    Enum.reverse(missing)
  end

  defp extract_spec_signature({:@, _meta, [{:spec, _spec_meta, [spec_ast]}]}) do
    spec_ast
    |> normalize_spec_head()
    |> signature_from_call()
  end

  defp extract_spec_signature(_), do: nil

  defp normalize_spec_head({:"::", _meta, [head, _type]}), do: normalize_spec_head(head)
  defp normalize_spec_head({:when, _meta, [head, _guards]}), do: normalize_spec_head(head)
  defp normalize_spec_head(head), do: head

  defp signature_from_call({name, _meta, args}) when is_atom(name) and is_list(args) do
    {name, length(args)}
  end

  defp signature_from_call({name, _meta, nil}) when is_atom(name) do
    {name, 0}
  end

  defp signature_from_call(_), do: nil

  defp extract_def_signature({:def, meta, [head_ast, _body_ast]}) do
    head_ast
    |> normalize_def_head()
    |> signature_with_line(meta)
  end

  defp extract_def_signature(_), do: nil

  defp normalize_def_head({:when, _meta, [head_ast, _guards]}), do: normalize_def_head(head_ast)
  defp normalize_def_head(head_ast), do: head_ast

  defp signature_with_line({name, _meta, args}, meta)
       when is_atom(name) and is_list(args) do
    {name, length(args), Keyword.get(meta, :line, 0)}
  end

  defp signature_with_line({name, _meta, nil}, meta) when is_atom(name) do
    {name, 0, Keyword.get(meta, :line, 0)}
  end

  defp signature_with_line(_, _), do: nil

  defp print_missing_specs(missing_specs) do
    Enum.each(missing_specs, fn %{file: file, line: line, name: name, arity: arity} ->
      Mix.shell().error("#{file}:#{line} missing @spec for #{name}/#{arity}")
    end)
  end
end
