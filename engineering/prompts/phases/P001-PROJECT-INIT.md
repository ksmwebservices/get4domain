# P001 — Client Project Initialization
# Get4Domain Engineering Standard v1.0
# Phase: P001 | Owner: Claude Code | Frequency: Once per client project

---

## YOUR ROLE IN THIS PHASE

Initialize a clean, production-ready engineering foundation for a new client project.

No business modules. No UI screens. No API implementation. No database tables.
Pure engineering skeleton only. Stop when initialization is complete.
Wait for the full engineering package (PRD, Functional Spec, DB Design, API Spec)
before starting P002 or P003.

---

## READ FIRST

1. CLAUDE.md (repo root)
2. WORKFLOW.md (repo root)
3. CURRENT_TASK.md (repo root) — confirm client ID and phase
4. engineering/industry-packs/{industry}/README.md
5. This file — then execute

---

## CLIENT DETAILS (confirm from CURRENT_TASK.md)

```
Client ID:    MR_TRAVELS_001
Client Name:  M.R. Travels & Tours
Industry:     Travel & Tours
Repo:         github.com/ksmwebservices/mr-travels-001
Local:        C:\Get4Domain\CLIENT_PROJECTS\MR_TRAVELS_001\
DB Dev:       mr_travels_dev
DB Prod:      mr_travels_prod
```

---

## IMPORTANT — INDEPENDENT REPOSITORY

This project is completely independent from the Get4Domain platform repo.

- Create at: `C:\Get4Domain\CLIENT_PROJECTS\MR_TRAVELS_001\`
- Its own Git repository — separate from get4domain
- Its own GitHub repo: github.com/ksmwebservices/mr-travels-001
- Never place client code inside the get4domain repo

---

## TASK 1 — ROOT PROJECT STRUCTURE

```
MR_TRAVELS_001/
├── frontend/
├── backend/
├── docs/                     ← client-specific docs only
├── deployment/
│   ├── docker/
│   ├── nginx/
│   └── scripts/
├── testing/
│   ├── e2e/
│   ├── integration/
│   └── unit/
├── scripts/
├── uploads/
├── assets/
│   ├── images/
│   ├── icons/
│   └── fonts/
├── logs/
├── .env.example
├── .gitignore
├── README.md
├── CLAUDE.md                 ← project-level instructions
└── docker-compose.yml
```

> Industry reference documentation lives in the Get4Domain platform repo at
> `engineering/industry-reference/travel/` — NOT duplicated here.
> This client repo contains only client-specific code and documentation.

---

## TASK 2 — INITIALIZE FRONTEND (Next.js)

```bash
cd frontend
npx create-next-app@latest . \
  --typescript --tailwind --eslint \
  --app --src-dir --import-alias "@/*" \
  --no-git --yes
```

Install packages:
```bash
npm install \
  @radix-ui/react-slot class-variance-authority clsx \
  tailwind-merge lucide-react \
  axios @tanstack/react-query zustand \
  react-hook-form @hookform/resolvers zod

npm install -D prettier prettier-plugin-tailwindcss
```

Create src/ structure:
```
frontend/src/
├── app/
│   ├── layout.tsx          ← root layout + metadata
│   ├── page.tsx            ← placeholder only
│   ├── globals.css         ← shadcn/ui CSS variables
│   └── not-found.tsx
├── components/
│   ├── ui/                 ← shadcn/ui (Bolt fills this in P002)
│   ├── layout/             ← Bolt fills in P002
│   └── common/             ← Bolt fills in P002
├── lib/
│   ├── utils.ts            ← cn() helper
│   └── axios.ts            ← API client + interceptors
├── hooks/                  ← custom hooks (P004)
├── types/
│   └── index.ts            ← ApiResponse, User, AuthTokens, etc.
├── services/
│   └── api/                ← per-module API functions (P004)
├── store/                  ← Zustand stores (P004)
├── utils/
├── constants/
│   └── index.ts            ← ROUTES, ROLES, APP_NAME
└── styles/
```

Configure:
- `next.config.ts` — standalone output, API rewrites, security headers
- `.prettierrc` — semi, singleQuote, tailwindcss plugin
- `tsconfig.json` — ensure `@/*` alias and strict mode

---

## TASK 3 — INITIALIZE BACKEND (NestJS)

```bash
cd backend
npx @nestjs/cli new . --package-manager npm --skip-git --strict --yes
```

Install packages:
```bash
npm install \
  @nestjs/config @nestjs/jwt @nestjs/passport \
  @nestjs/swagger @nestjs/throttler @nestjs/terminus \
  passport passport-jwt passport-local \
  bcryptjs class-validator class-transformer \
  @prisma/client prisma \
  helmet compression cookie-parser uuid

npm install -D \
  @types/passport-jwt @types/passport-local \
  @types/bcryptjs @types/cookie-parser \
  @types/compression @types/uuid
```

Create src/ structure:
```
backend/src/
├── main.ts                        ← helmet, CORS, Swagger, global wiring
├── app.module.ts                  ← ConfigModule, ThrottlerModule, DatabaseModule
├── app.controller.ts              ← health check only
├── app.service.ts                 ← health check only
├── config/
│   ├── app.config.ts              ← all env vars typed
│   └── index.ts
├── database/
│   ├── database.module.ts         ← @Global()
│   └── database.service.ts        ← PrismaClient wrapper
├── logger/
│   ├── logger.module.ts
│   └── logger.service.ts
├── common/
│   ├── filters/
│   │   └── http-exception.filter.ts
│   ├── interceptors/
│   │   └── response.interceptor.ts   ← standard JSON response
│   ├── pipes/
│   │   └── validation.pipe.ts
│   ├── guards/                        ← jwt.guard.ts added in P003
│   ├── decorators/
│   │   ├── current-user.decorator.ts
│   │   ├── roles.decorator.ts
│   │   └── public.decorator.ts
│   ├── interfaces/
│   │   └── index.ts                   ← JwtPayload, PaginatedResult
│   ├── constants/
│   │   └── index.ts                   ← ROLES, RESPONSE_MESSAGES
│   ├── utils/
│   │   └── pagination.util.ts
│   └── dto/
└── modules/
    ├── auth/                          ← shell only (P003 implements)
    │   ├── auth.module.ts
    │   ├── dto/
    │   ├── guards/
    │   └── strategies/
    ├── users/
    │   ├── users.module.ts
    │   └── dto/
    ├── roles/
    │   ├── roles.module.ts
    │   └── dto/
    └── permissions/
        ├── permissions.module.ts
        └── dto/
```

main.ts must configure:
- `helmet()` — security headers
- `compression()` — gzip
- `cookieParser()` — cookies
- `enableCors()` — frontend URL only
- `setGlobalPrefix('api/v1')`
- `useGlobalPipes(globalValidationPipe)`
- `useGlobalFilters(new AllExceptionsFilter())`
- `useGlobalInterceptors(new ResponseInterceptor())`
- Swagger (dev only)
- `void bootstrap()`

---

## TASK 4 — CONFIGURE PRISMA

```
backend/prisma/
├── schema.prisma     ← generator + datasource only, no models yet
├── migrations/       ← empty, models added in P003
└── seeds/            ← empty, seeds added in P003
```

schema.prisma:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Business models will be added in P003
// after PRD and DB Design are received
```

---

## TASK 5 — DOCKER

docker-compose.yml (root) — services:
- `postgres` (postgres:16-alpine, health check, named volume)
- `backend` (dev stage, depends on postgres)
- `frontend` (dev stage, depends on backend)
- `pgadmin` (profile: tools)
- Named network, named volume

backend/Dockerfile — multi-stage:
- `base`: node:22-alpine
- `development`: npm ci + dev server
- `builder`: npm ci + prisma generate + npm run build
- `production`: prod deps + non-root user

frontend/Dockerfile — multi-stage:
- `base`: node:22-alpine
- `development`: npm ci + dev server
- `builder`: npm ci + npm run build
- `production`: standalone output + non-root user

deployment/nginx/nginx.conf:
- Reverse proxy: /api/ → backend:3001
- Frontend: / → frontend:3000
- SSL-ready structure (certs added in P006)

---

## TASK 6 — ROOT FILES

### .env.example
```
APP_NAME="M.R. Travels & Tours"
NODE_ENV=development
PORT=3001
CLIENT_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1

DATABASE_URL=postgresql://postgres:PASSWORD@localhost:5432/mr_travels_dev
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_strong_password
POSTGRES_DB=mr_travels_dev

JWT_ACCESS_SECRET=your_access_secret_min_32_chars
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your_refresh_secret_min_32_chars
JWT_REFRESH_EXPIRES_IN=7d

BCRYPT_SALT_ROUNDS=10
THROTTLE_TTL=60
THROTTLE_LIMIT=100
MAX_FILE_SIZE=10485760
```

### CLAUDE.md (project-level)
Project-specific instructions:
- Client: MR_TRAVELS_001
- Phase tracker reference
- Module list
- Do not modify rules

### README.md
- Project name + client info
- Technology stack table
- Quick start (clone → env → install → run)
- Phase table
- Dev URLs

---

## TASK 7 — GIT

```bash
git init
git config user.email "dev@get4domain.com"
git config user.name "Get4Domain Engineering"
git branch -m main
git remote add origin https://github.com/ksmwebservices/mr-travels-001
git add .
git commit -m "feat: P001 – MR_TRAVELS_001 engineering foundation

Get4Domain Engineering Standard v1.0
Client: M.R. Travels & Tours
Stack: Next.js + NestJS + Prisma + PostgreSQL
Auth: JWT + Refresh Token + RBAC architecture
Docker: Multi-stage dev/prod builds
Industry reference: travel/ (documentation)"

git checkout -b develop
```

---

## TASK 8 — BUILD VERIFICATION

```bash
cd backend && npm run build    # 0 errors required
cd backend && npm run lint     # 0 errors required
cd frontend && npm run build   # 0 errors required
cd frontend && npm run lint    # 0 errors required
```

Fix ALL errors. Warnings acceptable.

---

## DELIVERABLES

Provide this report when complete:

```
P001 — MR_TRAVELS_001 INITIALIZATION COMPLETE
===============================================

1. FOLDER TREE: [full tree]

2. TECHNOLOGIES INSTALLED:
   Frontend: Next.js vX, React vX, Tailwind vX, [packages]
   Backend: NestJS vX, Prisma vX, [packages]

3. CONFIGURATION:
   - TypeScript strict: ✅
   - ESLint: ✅
   - Prettier: ✅
   - Docker: ✅
   - Swagger: ✅ (dev only)
   - Global exception filter: ✅
   - Global response interceptor: ✅
   - Global validation pipe: ✅

4. BUILD STATUS:
   Backend build: ✅ PASS / ❌ FAIL
   Backend lint:  ✅ PASS / ❌ FAIL
   Frontend build: ✅ PASS / ❌ FAIL
   Frontend lint:  ✅ PASS / ❌ FAIL

5. GIT:
   Branches: main, develop
   Remote: github.com/ksmwebservices/mr-travels-001
   Commits: [count]
   Last commit: [message]

6. INDUSTRY REFERENCE:
   engineering/industry-reference/travel/ — [file count] files created

7. PENDING:
   - Push to GitHub (manual — requires credentials)
   - Awaiting full engineering package:
     PRD, Functional Spec, Database Design, API Spec

8. READY FOR:
   P002 (Bolt UI) + P003 (Backend) — after engineering package received
```

---

## STOP HERE

Do not start P002 or P003.
Do not create business modules.
Do not design UI screens.
Wait for ChatGPT to provide the complete engineering package before proceeding.
