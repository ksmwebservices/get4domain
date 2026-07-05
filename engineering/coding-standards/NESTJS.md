# NestJS Standards — Get4Domain v1.0

## Module Structure (per feature)
modules/bookings/
  bookings.module.ts
  bookings.controller.ts
  bookings.service.ts
  dto/
    create-booking.dto.ts
    update-booking.dto.ts

## Rules
- One module per feature
- Controllers: HTTP only — no business logic
- Services: Business logic only
- DTOs: class-validator always
- Use @ApiTags on every controller
- Use @Public() to exempt from JWT guard
- Use @Roles() for RBAC
- Always use DatabaseService, never PrismaClient directly
