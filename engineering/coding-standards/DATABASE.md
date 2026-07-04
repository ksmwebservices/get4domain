# Database Standards — Get4Domain

## ORM

- Prisma is the only supported ORM. Never write raw SQL without explicit
  approval, and never bypass Prisma with a direct driver call.
- Always access the database through the project's `DatabaseService` —
  never instantiate or import `PrismaClient` directly outside that service.

## Model Conventions

- Every model has: `id String @id @default(uuid())`.
- Every model has: `createdAt DateTime @default(now())` and
  `updatedAt DateTime @updatedAt`.
- Every model that supports deletion has: `deletedAt DateTime?` — this is a
  **soft delete** marker. Records are never hard-deleted from the database.
- Every query that lists or fetches records filters `deletedAt: null` unless
  explicitly fetching deleted/archived records.

## Naming

| Element      | Format           | Example                    |
|--------------|------------------|------------------------------|
| Model names  | PascalCase       | `User`, `Booking`, `Vehicle` |
| Field names  | camelCase        | `firstName`, `vehicleId`     |
| Enum values  | UPPER_SNAKE_CASE | `PENDING`, `IN_PROGRESS`     |

## Writes

- Any operation that touches more than one table in a single logical action
  must use a Prisma transaction (`prisma.$transaction`).
- Unique/duplicate violations surface as `ConflictException` at the service
  layer, not as raw Prisma errors.

## Migrations

- Migrations are created with `npx prisma migrate dev --name "description"`
  and committed to `prisma/migrations/`.
- Never hand-edit a generated migration file after it has been applied to a
  shared environment — create a new migration instead.

## Seeding

- Seed scripts live in `prisma/seeds/` and run in a fixed, documented order
  (roles → core accounts → minimal sample data per module).
- Seed data is for development/testing only — never seed production with
  placeholder business data.
