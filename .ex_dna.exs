%{
  min_mass: 40,
  literal_mode: :abstract,
  min_similarity: 0.85,
  excluded_macros: [:schema, :pipe_through, :plug],
  normalize_pipes: true
}
