{
  description = "LiveCanvas mobile Expo development shell";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
  };

  outputs = { nixpkgs, ... }:
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
      apps = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };
        in
        {
          pnpm = {
            type = "app";
            program = "${pkgs.pnpm}/bin/pnpm";
          };
        });

      devShells = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };
        in
        {
          default = pkgs.mkShellNoCC {
            packages = with pkgs; [
              nodejs_20
              pnpm
            ];

            shellHook = ''
              export PNPM_HOME="$PWD/.pnpm-home"
              export PATH="$PNPM_HOME:$PATH"
              export npm_config_update_notifier=false
            '';
          };
        });
    };
}
