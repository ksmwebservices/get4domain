# NestJS Standards — Get4Domain

## Module Structure

- One module per feature — never combine unrelated features in one module.
- Every module is self-contained: its own controller, service, DTOs, and
  (if needed) guards/strategies live under `modules/{feature}/`.

## Layering

- **Controllers**: HTTP handling only (routing, params, status codes). No
  business logic.
- **Services**: Business logic only. No direct HTTP concerns (no
  `@Req`/`@Res`, no status codes).
- **DTOs**: Input/output shape validation using `class-validator` decorators
  on every field, plus `@ApiProperty()` for Swagger.

## Swagger

- Every controller has `@ApiTags('ModuleName')`.
- Every endpoint has `@ApiOperation({ summary: '...' })`.
- Authenticated endpoints have `@ApiBearerAuth('JWT-auth')`.

## Auth & Access Control

- JWT guard is registered globally (`APP_GUARD`) in `AppModule`.
- Use `@Public()` to exempt a route from the JWT guard.
- Use `@Roles(...)` + `RolesGuard` for role-based access control.
- Use `@CurrentUser()` to extract the authenticated user from the request,
  never read `request.user` directly in a controller.

## Database Access

- Always inject and use `DatabaseService` — never import `PrismaClient`
  directly in a controller or service.
- Apply the soft-delete filter (`deletedAt: null`) on every `findAll`/
  `findOne` query.
- Use Prisma transactions (`$transaction`) for any multi-table write.
- Throw `NotFoundException` when a requested record does not exist.
- Throw `ConflictException` for duplicate/unique-constraint violations.

## Responses

- Every API response goes through the global `ResponseInterceptor` and
  matches the standard shape:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Success",
  "data": {},
  "timestamp": "2025-07-04T00:00:00.000Z"
}
```

- Do not bypass the interceptor or hand-roll response shapes in a
  controller.
- Errors are caught by the global `AllExceptionsFilter` — do not swallow
  exceptions in a controller with try/catch just to reformat them.

## Bootstrap (`main.ts`)

Global pipes, filters, and interceptors are configured in `main.ts` only:

- `helmet()` for security headers
- `compression()` for gzip
- `cookieParser()`
- `enableCors()` restricted to the frontend URL
- `setGlobalPrefix('api/v1')`
- `useGlobalPipes` with a `ValidationPipe` (whitelist + transform)
- `useGlobalFilters(new AllExceptionsFilter())`
- `useGlobalInterceptors(new ResponseInterceptor())`
- `SwaggerModule.setup()` (dev only)

## Pagination

- Every list endpoint accepts `page`/`limit` query params and returns a
  paginated result shape (`items`, `total`, `page`, `limit`).

## What to never do

- Never put business logic in a controller.
- Never expose password hashes, refresh-token hashes, or other sensitive
  fields in a response DTO.
- Never write raw SQL without explicit review.
- Never create a business module during P001 (foundation only).
