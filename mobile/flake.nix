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
      pnpmFor = pkgs:
        pkgs.pnpm_10.override {
          version = "10.32.1";
          hash = "sha256-m5Q7lLyPVe+5k6rY5EtTjmsJHmCp5KlE3N6GmFXyM+M=";
          nodejs-slim = pkgs.nodejs-slim_26;
        };
    in
    {
      apps = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };
          pnpm = pnpmFor pkgs;
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
          pnpm = pnpmFor pkgs;
        in
        {
          default = pkgs.mkShellNoCC {
            packages = [
              pkgs.nodejs_26
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
