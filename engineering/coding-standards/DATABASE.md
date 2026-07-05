# Database Standards — Get4Domain v1.0

## Prisma Rules
- All IDs: String @id @default(uuid())
- All tables: createdAt, updatedAt
- Soft delete: deletedAt DateTime?
- Never raw SQL without review
- Always transactions for multi-table writes

## Naming
- Tables: PascalCase (User, Booking, Vehicle)
- Fields: camelCase (firstName, createdAt)
- Enum values: UPPER_SNAKE_CASE
