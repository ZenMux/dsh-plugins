# ZenMux Package Scope SDD

## Background / Problem

The plugin repository originally declared the unscoped package name `dsh-zenmux-oauth`. The release must be published under the ZenMux npm organization as `@zenmux/dsh-plugins`. DSH Loader configuration resolves the package by its npm name, so changing only the package manifest would leave the bundled loader patch pointing at a package that is not installed.

## Goals

- Publish version `0.1.1` as the public npm package `@zenmux/dsh-plugins` after the initial `0.1.0` release predated the formal GitHub repository.
- Keep the package manifest, bundled DSH Loader patch, invariant ownership, self-importing tests, and installation documentation aligned on the scoped name.
- Host the package source at `ZenMux/dsh-plugins` and preserve the original repository as an upstream remote.
- Preserve the existing OAuth implementation and runtime behavior.

## Non-goals

- Change the `/zenmux` command.
- Change OAuth endpoints, credentials, configuration, or token behavior.

## Affected Files / Modules

- `package.json`: npm package identity and repository metadata.
- `cordis.patch.yml`: DSH Loader module specifier.
- `src/index.ts` and `src/invariant.ts`: module documentation and package invariant ownership.
- `tests/*.spec.ts`: scoped package self-import and loader assertions.
- `README.md` and `README.zh.md`: npm installation command.

## Data Model / API Changes

There are no data-model or OAuth API changes. The public installation specifier changes from `dsh-zenmux-oauth` to `@zenmux/dsh-plugins`. GitHub installation uses `github:ZenMux/dsh-plugins`.

## Control Flow

After npm installation, DSH reads the package's `dsh.bundle.patch` declaration, inserts the `zenmux` controller, and imports `@zenmux/dsh-plugins`. The controller then follows the existing login, refresh, status, and logout paths unchanged.

## Edge Cases

- Scoped packages must be published with public access.
- The loader patch must use the scoped module specifier exactly.
- The existing unscoped package, if published independently later, is not an alias and receives no automatic migration.

## Validation Plan

- Run the full test suite and TypeScript build.
- Run `publint` against the built package.
- Inspect `npm pack --dry-run` output.
- Publish explicitly to the official npm registry with public access, then verify the registry version and dist-tag.

## Rollout / Backward Compatibility

Version `0.1.1` supersedes the initial `0.1.0` metadata-only release and becomes `latest`; no published version is replaced. The source history is pushed to `ZenMux/dsh-plugins`, with the original repository retained locally as `upstream`. Consumers should use `@zenmux/dsh-plugins` for npm installation.

## Open Questions

None.
