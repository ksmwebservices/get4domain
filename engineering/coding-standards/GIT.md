# Git Standards — Get4Domain

## Branch Strategy

```
main       → Production only. Direct push NEVER allowed.
develop    → Integration. All features merge here first.
feature/*  → One branch per feature. Branch from develop.
fix/*      → Bug fixes. Branch from develop.
hotfix/*   → Emergency production fixes. Branch from main.
release/*  → Release preparation. Branch from develop.
```

Branch names are kebab-case, e.g. `feature/vehicle-management`.

## Commit Format (Conventional Commits)

```
<type>: <short description in present tense>

Types:
  feat     → new feature
  fix      → bug fix
  docs     → documentation only
  chore    → maintenance, dependency updates
  refactor → code change without feature/fix
  test     → adding or fixing tests
  deploy   → deployment configuration
  style    → formatting, no logic change
```

Examples:

```
feat: add vehicle availability calendar API
fix: resolve GST rounding error in invoice calculation
docs: update booking module API specification
chore: upgrade Prisma to v7
test: add vehicle service unit tests
deploy: configure nginx SSL for production
refactor: extract booking validation to separate service
```

## Rules

- Never commit directly to `main`.
- Never commit directly to `develop` — use pull requests.
- One feature per branch.
- All CI checks must pass before merging.
- Squash commits when merging feature branches.
- Never commit `.env`, `.env.local`, or any file containing secrets.
- Never force-push to `main` or `develop`.
- Never skip commit hooks (`--no-verify`) without explicit instruction.
