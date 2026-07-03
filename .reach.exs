[
  # Brownfield smell suppressions live in .reach-baseline.json; shrink that
  # file as existing smells are fixed so strict checks keep blocking new ones.
  checks: [
    baseline: ".reach-baseline.json"
  ]
]
