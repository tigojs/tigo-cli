# Changelog

## v0.11.2

- Feat: change mock default value to `true` when initializing lambda dev env.

- Feat: cli tool will remove `.github` folder automatically after lambda dev env initialized.

- Feat: when intializing labmda dev env, version of the env will be written to `package.json`.

- Feat: cli tool will ask user to init git repository if git has been detected.

- Fix: cannot read dev config when initializing lambda dev env.

- Fix: correct version in returns of `checkGit` method.

## v0.11.1

- Minor: fit `tigo-lambda-devenv` repo name change.

## v0.11.0

- Feat: cli tool will fetch lambda developmenet environment from releaes now, not clone the repo.

- Feat: allow user set project info when initializing the lambda development environment.

## v0.10.0

- Feat: support before install script.

## v0.9.2

- Feat: panel upgrade command will output the latest version info now.

## v0.9.1

- Fix: panel version will be saved after upgrading.

## v0.9.0

- Feat: added panel module.

- Fix: `downloadFileWithProgress` method will stop progress bar first when an error ocurred.

## v0.8.0

- Feat: added migrater module.

- Feat: allow to add lambda package by installer.
