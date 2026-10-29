# tickets

@README.md

## UI comes from tilewise

- Components and tokens are tilewise's `@tilewise/*` packages from npm. To change one, change it in
  tilewise and bump the version here.
- Components that only tickets uses, like `ItemKey` and `RailLabel`, live in `apps/web`.

## Before committing

- Run the typecheck and test commands from the README.
- Scope each commit by the apps it touches (`api`, `web`, `db`), one commit per task.
