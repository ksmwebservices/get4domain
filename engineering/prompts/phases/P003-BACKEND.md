# P003 — Backend Modules, APIs, Database
# Get4Domain Engineering Standard v1.0
# Phase: P003 | Owner: Claude Code | Runs parallel with P002 (Bolt)

---

## YOUR ROLE IN THIS PHASE

Implement the complete backend — authentication, database models,
all business modules, APIs, and business logic.
The P001 engineering foundation is already in place. Build on top of it.

---

## READ FIRST

1. Read `CLAUDE.md` in GET4DOMAIN repo
2. Read the client PRD (provided by ChatGPT in `docs/`)
3. Read the Database Design document (provided by ChatGPT in `docs/`)
4. Read the API Specification document (provided by ChatGPT in `docs/`)
5. Read `engineering/industry-packs/{industry}/MODULE_LIST.md`
6. Read this file completely — then execute

---

## P003 SEQUENCE

Execute in this exact order:

```
Step 1: Prisma Schema (all models)
Step 2: Run migration
Step 3: Auth Module (JWT + refresh token + RBAC)
Step 4: Users Module
Step 5: Roles + Permissions Modules
Step 6: Business Module 1
Step 7: Business Module 2
...
Step N: Seed data
Step N+1: Build + Lint verification
```

---

## STEP 1 — PRISMA SCHEMA

Add ALL models to `backend/prisma/schema.prisma`.

### Every model must have:
```prisma
model ModelName {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?  // soft delete
  // ... fields
}
```

### For MR_TRAVELS_001, create these models:
```
User, Role, Permission
TourPackage
Vehicle, VehicleType
Driver, DriverDocument
Booking, BookingPassenger
TripSheet
CorporateClient, CorporateContract
Invoice, InvoiceItem
Payment
Account, AccountEntry
```

After writing schema:
```bash
npx prisma migrate dev --name "initial-schema"
npx prisma generate
```

---

## STEP 2 — AUTH MODULE

Implement `src/modules/auth/`:

### Files to create:
```
auth.module.ts
auth.controller.ts     ← POST /auth/login, /auth/refresh, /auth/logout, GET /auth/me
auth.service.ts        ← login, validateUser, refreshToken, logout logic
dto/
  login.dto.ts         ← email, password (class-validator)
  refresh-token.dto.ts ← refreshToken string
guards/
  jwt-auth.guard.ts    ← extends AuthGuard('jwt'), respects @Public()
  roles.guard.ts       ← checks @Roles() decorator against JWT payload
strategies/
  jwt.strategy.ts      ← validates access token, returns JwtPayload
  jwt-refresh.strategy.ts ← validates refresh token
```

### Auth flow:
1. POST /auth/login → validate credentials → return {accessToken, refreshToken}
2. Access token: 15 min expiry, contains {sub, email, role}
3. Refresh token: 7 day expiry, stored hashed in DB
4. POST /auth/refresh → validate refresh token → return new access token
5. POST /auth/logout → invalidate refresh token in DB
6. GET /auth/me → return current user profile

### Password handling:
- Hash with bcryptjs (saltRounds from config)
- Never store plain text
- Never return password hash in responses

### JWT Guard must:
- Be applied globally in AppModule (APP_GUARD)
- Skip routes decorated with @Public()
- Extract user from token and attach to request

---

## STEP 3 — USERS MODULE

Implement `src/modules/users/`:

```
users.module.ts
users.controller.ts    ← CRUD + GET /users/me
users.service.ts       ← CRUD + profile management
dto/
  create-user.dto.ts
  update-user.dto.ts
  user-filter.dto.ts   ← for list with pagination
```

### User model fields (minimum):
- id, email, password (hashed), firstName, lastName
- phone, role, isActive
- refreshTokenHash (for token validation)
- createdAt, updatedAt, deletedAt

### Rules:
- Never return password or refreshTokenHash in responses
- Soft delete only (set deletedAt, do not delete record)
- Pagination on list endpoint

---

## STEP 4 — BUSINESS MODULES

For each business module, create:

```
modules/{module-name}/
├── {module}.module.ts
├── {module}.controller.ts
├── {module}.service.ts
└── dto/
    ├── create-{module}.dto.ts
    ├── update-{module}.dto.ts
    └── {module}-filter.dto.ts
```

### Every Controller must have:
```typescript
@ApiTags('ModuleName')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('module-name')
export class ModuleController {
  @Get()
  @Roles(ROLES.ADMIN, ROLES.MANAGER)
  @ApiOperation({ summary: 'List all X with pagination' })
  findAll(@Query() filter: FilterDto) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get X by ID' })
  findOne(@Param('id') id: string) {}

  @Post()
  @Roles(ROLES.ADMIN, ROLES.MANAGER)
  @ApiOperation({ summary: 'Create new X' })
  create(@Body() dto: CreateDto, @CurrentUser() user: JwtPayload) {}

  @Patch(':id')
  @ApiOperation({ summary: 'Update X' })
  update(@Param('id') id: string, @Body() dto: UpdateDto) {}

  @Delete(':id')
  @Roles(ROLES.ADMIN)
  @ApiOperation({ summary: 'Soft delete X' })
  remove(@Param('id') id: string) {}
}
```

### Every Service must:
- Use `DatabaseService` (injected via constructor)
- Apply soft delete filter on all findAll/findOne queries
- Return paginated results from list methods
- Throw `NotFoundException` when record not found
- Throw `ConflictException` for duplicate records
- Never expose password/sensitive fields

### Every DTO must:
- Use `class-validator` decorators on every field
- Use `@IsOptional()` for optional fields
- Use `@IsUUID()` for ID fields
- Have Swagger `@ApiProperty()` on every field

---

## STEP 5 — SEED DATA

Create `backend/prisma/seeds/seed.ts`:

```typescript
// Seed order:
// 1. Roles (SUPER_ADMIN, ADMIN, MANAGER, STAFF, DRIVER, CLIENT)
// 2. Super admin user (dev credentials)
// 3. Sample data per module (minimal — just enough to test)
```

Add to `package.json`:
```json
"prisma": {
  "seed": "ts-node prisma/seeds/seed.ts"
}
```

Run:
```bash
npx prisma db seed
```

---

## STEP 6 — UPDATE APP MODULE

Register all business modules in `app.module.ts`:
```typescript
imports: [
  // ... existing
  AuthModule,
  UsersModule,
  RolesModule,
  PermissionsModule,
  // Business modules:
  PackagesModule,
  VehiclesModule,
  DriversModule,
  BookingsModule,
  TripSheetsModule,
  CorporateModule,
  InvoicesModule,
  AccountsModule,
  ReportsModule,
]
```

---

## STEP 7 — BUILD AND LINT VERIFICATION

```bash
cd backend
npm run build     # must be 0 errors
npm run lint      # must be 0 errors
```

Fix ALL errors. Warnings are acceptable.

---

## DELIVERABLES

```
P003 — BACKEND COMPLETE
========================

1. DATABASE: [model count] models, migration applied ✅/❌
2. AUTH: login, refresh, logout, me ✅/❌
3. MODULES COMPLETE: [list each module ✅/❌]
4. SWAGGER: http://localhost:3001/api/docs ✅/❌
5. SEED: [record count per model]
6. BUILD: ✅/❌
7. LINT: ✅/❌ [error count]
8. READY FOR: P004 (Integration with Bolt UI)
```

---

## STRICT RULES

- ✅ Every endpoint must have Swagger decorators
- ✅ Every DTO must have class-validator decorators
- ✅ All responses go through ResponseInterceptor
- ✅ Soft delete on all modules
- ✅ Pagination on all list endpoints
- ✅ Build must pass 0 errors before marking complete
- ❌ Do NOT modify frontend files
- ❌ Do NOT bypass the JWT guard without @Public()
- ❌ Do NOT hardcode any values (use config/constants)
- ❌ Do NOT create raw SQL queries

