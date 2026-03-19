# LiveCanvas Mobile

This is a standalone [Expo](https://expo.dev) app created with the default
[`create-expo-app`](https://www.npmjs.com/package/create-expo-app) template.
The backend repo does not use a repo-root JavaScript workspace; mobile tooling
stays scoped to `mobile/`.

## Environment

Use the local Nix dev shell to provide Node, `pnpm`, and `watchman`.

If `nix` is not on your `PATH`, substitute
`/nix/var/nix/profiles/default/bin/nix` in the commands below.

```bash
nix --extra-experimental-features "nix-command flakes" develop
```

## Common Commands

Start the Expo dev server:

```bash
pnpm start
```

Open platform targets:

```bash
pnpm android
pnpm ios
pnpm web
```

Run linting:

```bash
pnpm lint
```

Reset the starter app:

```bash
pnpm run reset-project
```

## Project Notes

- App routes live in `app/`.
- This project uses [Expo Router](https://docs.expo.dev/router/introduction/).
- Dependencies were installed with `pnpm`, so the lockfile is
  `pnpm-lock.yaml`.

## Learn More

- [Expo documentation](https://docs.expo.dev/)
- [Expo Router docs](https://docs.expo.dev/router/introduction/)
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/)
