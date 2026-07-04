# TypeScript Standards — Get4Domain

Applies to every frontend and backend TypeScript file in every Get4Domain
repository (platform and client projects).

## Compiler

- `strict: true` in `tsconfig.json` always — no exceptions.
- No implicit `any`. If the compiler would infer `any`, add an explicit type.

## Types

- Never use `any`. Use `unknown` and narrow it, or define a proper
  `interface`/`type`.
- Always type function return values explicitly — do not rely on inference
  for exported/public functions.
- Use `interface` for object shapes (props, DTOs, entities).
- Use `type` for unions, intersections, and mapped/conditional types.
- Prefer `readonly` on properties that must not be reassigned after
  construction.

## Null Safety

- Use optional chaining (`?.`) instead of manual null checks where possible.
- Use nullish coalescing (`??`) instead of `||` when the falsy values `0`,
  `''`, or `false` are valid.
- Avoid non-null assertions (`!`) except where the invariant is guaranteed by
  a prior check in the same function.

## Naming

| Element          | Format             | Example              |
|------------------|--------------------|-----------------------|
| Files            | kebab-case         | `auth.service.ts`     |
| Classes          | PascalCase         | `AuthService`         |
| Interfaces       | PascalCase         | `JwtPayload`          |
| Variables        | camelCase          | `accessToken`         |
| Constants        | UPPER_SNAKE_CASE   | `JWT_ACCESS_SECRET`   |
| Enums            | PascalCase name    | `BookingStatus`       |
| Enum values      | UPPER_SNAKE_CASE   | `CONFIRMED`           |
| DTOs             | PascalCase + Dto   | `CreateBookingDto`    |
| React components | PascalCase         | `BookingCard`         |
| React hooks      | camelCase + use    | `useBookings`         |

## General

- No `console.log` in production code — use the project `Logger` service.
- No dead code, commented-out blocks, or placeholder/dummy logic.
- Keep functions single-purpose; extract instead of growing one function.
- Prefer explicit imports over barrel re-exports that hide circular
  dependencies.
