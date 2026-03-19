{
  description = "LiveCanvas mobile Expo development shell";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/f8573b9c935cfaa162dd62cc9e75ae2db86f85df";
  };

  outputs = { self, nixpkgs }:
    let
      systems = [
        "aarch64-darwin"
        "x86_64-darwin"
        "aarch64-linux"
        "x86_64-linux"
      ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in
    {
      devShells = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };
        in
        {
          default = pkgs.mkShell {
            packages = with pkgs; [
              nodejs_22
              pnpm
              watchman
            ];
          };
        });
    };
}
