%{
  configs: [
    %{
      name: "default",
      plugins: [
        {ExSlop, []},
        {ExDNA.Credo,
         [
           min_mass: 40,
           excluded_macros: [:schema, :pipe_through, :plug],
           normalize_pipes: true
         ]}
      ]
    }
  ]
}
