%{
  configs: [
    %{
      name: "default",
      plugins: [
        {ExSlop, []},
        {ExDNA.Credo,
         [
           min_mass: 30,
           excluded_macros: [:schema, :pipe_through, :plug],
           normalize_pipes: true
         ]}
      ]
    }
  ]
}
