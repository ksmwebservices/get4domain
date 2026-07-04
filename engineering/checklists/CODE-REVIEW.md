# Code Review Checklist — Get4Domain

Use this checklist when reviewing any pull request into `develop` or `main`.

## Structure

- [ ] Change stays within its owner's territory (Claude Code: backend/DB/
      APIs/auth/integration/testing/deployment; Bolt: frontend UI only)
- [ ] One module per feature; no unrelated features combined
- [ ] Controllers contain no business logic; services contain no HTTP
      concerns

## TypeScript

- [ ] `strict` mode compiles with no errors
- [ ] No `any` types introduced
- [ ] Function return types are explicit on exported functions
- [ ] Naming conventions followed (see `TYPESCRIPT.md`)

## NestJS / API

- [ ] `@ApiTags()` and `@ApiOperation()` present on every endpoint
- [ ] DTOs have `class-validator` decorators on every field
- [ ] Response shape goes through `ResponseInterceptor` (not hand-rolled)
- [ ] New protected routes have `@Roles()` / are exempted with `@Public()`
      deliberately, not by omission

## Database

- [ ] `DatabaseService` used, not a direct `PrismaClient` import
- [ ] Soft delete respected (`deletedAt` filter on reads, no hard deletes)
- [ ] Multi-table writes wrapped in a transaction
- [ ] Migration included if the schema changed

## Security

- [ ] No secrets, tokens, or credentials committed
- [ ] No new `console.log` of sensitive data
- [ ] Input validation exists at every system boundary

## Git Hygiene

- [ ] Commit messages follow Conventional Commits format
- [ ] Branch name matches `feature/*`, `fix/*`, `hotfix/*`, or `release/*`
- [ ] No direct commits to `main` or `develop`

## Tests

- [ ] New business logic has corresponding unit tests
- [ ] Existing tests still pass
