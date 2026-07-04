# P001 — Client Project Initialization
# Get4Domain Engineering Standard v1.0
# Phase: P001 | Owner: Claude Code | Frequency: Once per client project

---

## YOUR ROLE IN THIS PHASE

Initialize a complete, production-ready engineering foundation for a new client project.
No business modules. No UI. No dummy data. Pure engineering skeleton only.

---

## READ FIRST

1. Read `CLAUDE.md` (in get4domain repo root) — all sections
2. Read `engineering/industry-packs/{industry}/README.md` — understand client industry
3. Read `engineering/industry-packs/{industry}/MODULE_LIST.md` — know upcoming modules
4. Read any PRD or BRD documents provided by ChatGPT in `docs/`
5. Read this file completely — then execute

---

## CLIENT INFORMATION (fill before running)

```
Client ID:       [e.g. MR_TRAVELS_001]
Client Name:     [e.g. M.R. Travels & Tours]
Industry:        [e.g. travel]
GitHub Repo:     [e.g. github.com/ksmwebservices/mr-travels-001]
Dev URL:         [e.g. mr-travels-dev.get4domain.com]
DB Name (dev):   [e.g. mr_travels_dev]
DB Name (prod):  [e.g. mr_travels_prod]
```

---

## TASK 1 — CREATE PROJECT FOLDER IN CLIENT_PROJECTS

```
C:\GET4DOMAIN\CLIENT_PROJECTS\{CLIENT_ID}\
```

The GitHub repo should already be created before P001 starts.
Clone it locally:
```bash
cd C:\GET4DOMAIN\CLIENT_PROJECTS
git clone https://github.com/ksmwebservices/{repo-name} {CLIENT_ID}
cd {CLIENT_ID}
```

---

## TASK 2 — CREATE PROJECT STRUCTURE

```
{CLIENT_ID}/
├── frontend/
├── backend/
├── database/
│   ├── migrations/
│   └── seeds/
├── docs/
│   └── prompts/
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
└── docker-compose.yml
```

---

## TASK 3 — INITIALIZE FRONTEND (Next.js)

```bash
cd frontend
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-git \
  --yes
```

Install additional packages:
```bash
npm install \
  @radix-ui/react-slot \
  class-variance-authority \
  clsx \
  tailwind-merge \
  lucide-react \
  axios \
  @tanstack/react-query \
  zustand \
  react-hook-form \
  @hookform/resolvers \
  zod

npm install -D prettier prettier-plugin-tailwindcss
```

Create src folder structure:
```
frontend/src/
├── app/
│   ├── layout.tsx           ← root layout, metadata
│   ├── page.tsx             ← placeholder only ("P001 complete")
│   ├── globals.css          ← shadcn/ui CSS variables
│   └── not-found.tsx        ← 404 placeholder
├── components/
│   ├── ui/                  ← shadcn/ui components (Bolt adds here)
│   ├── layout/              ← header, sidebar, footer (Bolt adds here)
│   └── common/              ← shared components (Bolt adds here)
├── lib/
│   ├── utils.ts             ← cn() helper for shadcn
│   └── axios.ts             ← API client with interceptors
├── hooks/                   ← custom React hooks (P004)
├── types/
│   └── index.ts             ← global TypeScript types
├── services/
│   └── api/                 ← per-module API functions (P004)
├── store/                   ← Zustand stores (P004)
├── utils/                   ← helper functions
├── constants/
│   └── index.ts             ← route constants, role constants
└── styles/                  ← additional CSS if needed
```

Configure `next.config.ts`:
- output: 'standalone'
- API rewrites to backend
- Image domains
- Security headers

Create `.prettierrc`:
```json
{
  "semi": true,
  "trailingComma": "all",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

---

## TASK 4 — INITIALIZE BACKEND (NestJS)

```bash
cd backend
npx @nestjs/cli new . --package-manager npm --skip-git --strict --yes
```

Install packages:
```bash
npm install \
  @nestjs/config \
  @nestjs/jwt \
  @nestjs/passport \
  @nestjs/swagger \
  @nestjs/throttler \
  @nestjs/terminus \
  passport \
  passport-jwt \
  passport-local \
  bcryptjs \
  class-validator \
  class-transformer \
  @prisma/client \
  prisma \
  helmet \
  compression \
  cookie-parser \
  uuid

npm install -D \
  @types/passport-jwt \
  @types/passport-local \
  @types/bcryptjs \
  @types/cookie-parser \
  @types/compression \
  @types/uuid
```

Create backend structure:
```
backend/src/
├── main.ts                  ← bootstrap: helmet, CORS, Swagger, pipes, filters
├── app.module.ts            ← root: ConfigModule, ThrottlerModule, DatabaseModule
├── app.controller.ts        ← health check endpoint only
├── app.service.ts           ← health check service only
├── config/
│   ├── app.config.ts        ← all env vars typed and loaded
│   └── index.ts
├── database/
│   ├── database.module.ts   ← @Global() module
│   └── database.service.ts  ← PrismaClient wrapper
├── logger/
│   ├── logger.module.ts
│   └── logger.service.ts    ← structured logger
├── common/
│   ├── filters/
│   │   └── http-exception.filter.ts  ← catches all exceptions
│   ├── interceptors/
│   │   └── response.interceptor.ts   ← standard JSON response
│   ├── pipes/
│   │   └── validation.pipe.ts        ← global ValidationPipe
│   ├── guards/
│   │   └── (jwt.guard.ts added in P003)
│   ├── decorators/
│   │   ├── current-user.decorator.ts
│   │   ├── roles.decorator.ts
│   │   └── public.decorator.ts
│   ├── interfaces/
│   │   └── index.ts          ← JwtPayload, PaginatedResult, etc.
│   ├── constants/
│   │   └── index.ts          ← ROLES, RESPONSE_MESSAGES, APP_CONSTANTS
│   ├── utils/
│   │   └── pagination.util.ts
│   └── dto/                  ← shared DTOs
└── modules/
    ├── auth/                 ← shell only in P001 (implemented in P003)
    │   ├── auth.module.ts
    │   ├── dto/
    │   ├── guards/
    │   └── strategies/
    ├── users/                ← shell only
    │   ├── users.module.ts
    │   └── dto/
    ├── roles/                ← shell only
    │   ├── roles.module.ts
    │   └── dto/
    ├── permissions/          ← shell only
    │   ├── permissions.module.ts
    │   └── dto/
    └── [business-modules]/   ← created in P003
```

### main.ts must configure:
- `helmet()` — security headers
- `compression()` — gzip
- `cookieParser()` — cookie support
- `enableCors()` — frontend URL only
- `setGlobalPrefix('api/v1')` — all routes prefixed
- `useGlobalPipes(globalValidationPipe)` — validation
- `useGlobalFilters(new AllExceptionsFilter())` — error handling
- `useGlobalInterceptors(new ResponseInterceptor())` — standard response
- `SwaggerModule.setup()` — Swagger UI (dev only)
- `void bootstrap()` — no floating promises

---

## TASK 5 — CONFIGURE PRISMA

Create `backend/prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Business models added in P003
```

Create folders:
- `backend/prisma/migrations/`
- `backend/prisma/seeds/`

---

## TASK 6 — CREATE DOCKER FILES

### `docker-compose.yml` (root level) must include:
- `postgres` service (postgres:16-alpine)
- `backend` service (NestJS)
- `frontend` service (Next.js)
- `pgadmin` service (profile: tools)
- Named network
- Named volume for postgres data
- Health checks on postgres

### `backend/Dockerfile` — multi-stage:
- `base` stage: node:22-alpine
- `development` stage: npm ci + dev server
- `builder` stage: npm ci + prisma generate + npm run build
- `production` stage: production deps only + distroless user

### `frontend/Dockerfile` — multi-stage:
- `base` stage: node:22-alpine
- `development` stage: npm ci + dev server
- `builder` stage: npm ci + npm run build
- `production` stage: standalone output + non-root user

---

## TASK 7 — CREATE ROOT ENVIRONMENT FILES

### `.env.example` (root):
```
APP_NAME="Client Name"
NODE_ENV=development
PORT=3001
API_PREFIX=api/v1
CLIENT_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
DATABASE_URL=postgresql://postgres:PASSWORD@localhost:5432/{db_name}
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_strong_password
POSTGRES_DB={db_name}
POSTGRES_PORT=5432
JWT_ACCESS_SECRET=your_access_secret_min_32_chars
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your_refresh_secret_min_32_chars
JWT_REFRESH_EXPIRES_IN=7d
BCRYPT_SALT_ROUNDS=10
THROTTLE_TTL=60
THROTTLE_LIMIT=100
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads
```

---

## TASK 8 — CREATE SCRIPTS

```
scripts/
├── dev.sh          ← start postgres + backend + frontend
├── build.sh        ← build frontend + backend
├── migrate.sh      ← run prisma migrate dev
└── seed.sh         ← run prisma db seed
```

---

## TASK 9 — CREATE README.md

Include:
- Project name and client info
- Technology stack table
- Quick start (clone → env setup → install → run)
- Development phase table (P001-P006)
- Branch strategy
- Commit standards
- Environment URLs

---

## TASK 10 — INITIALIZE GIT

```bash
git init
git config user.email "dev@get4domain.com"
git config user.name "Get4Domain Engineering"
git branch -m main
git remote add origin https://github.com/ksmwebservices/{repo-name}
git add .
git commit -m "feat: P001 – {Client Name} engineering foundation

Get4Domain Engineering Standard v1.0
Stack: Next.js + NestJS + Prisma + PostgreSQL
Auth: JWT + Refresh Token + RBAC
Docker: Multi-stage dev/prod builds"
git checkout -b develop
```

---

## TASK 11 — VERIFY BUILD

```bash
# Backend must build with 0 errors
cd backend && npm run build
cd backend && npm run lint

# Frontend must build with 0 errors
cd frontend && npm run build
cd frontend && npm run lint
```

Fix ALL errors before committing. Warnings are acceptable.

---

## DELIVERABLES

```
P001 — PROJECT INITIALIZATION COMPLETE
=======================================

Client: {CLIENT_NAME}
Repo:   {GITHUB_REPO}

1. FOLDER STRUCTURE: [full tree]
2. PACKAGES INSTALLED: [backend + frontend key packages]
3. BUILD STATUS: backend ✅/❌ | frontend ✅/❌
4. LINT STATUS: backend ✅/❌ | frontend ✅/❌
5. GIT: [branches] [commit count] [last commit]
6. PENDING: [list anything incomplete]
7. READY FOR: P002 (Bolt) + P003 (Backend) — run simultaneously
```

---

## STRICT RULES

- ✅ Initialize only — foundation, not features
- ✅ Backend build must pass with 0 errors
- ✅ Frontend build must pass with 0 errors
- ✅ Standard response interceptor must be wired globally
- ✅ Swagger must be configured (dev only)
- ❌ Do NOT create business modules
- ❌ Do NOT design or build any UI screens
- ❌ Do NOT add dummy/sample data
- ❌ Do NOT modify the GET4DOMAIN platform repo

