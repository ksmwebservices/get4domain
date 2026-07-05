# P002 — Frontend UI Development
# Get4Domain Engineering Standard v1.0
# Phase: P002 | Owner: BOLT | Runs parallel with P003 (Backend)

---

## THIS PHASE IS FOR BOLT — NOT CLAUDE CODE

Claude Code does NOT execute P002.
Claude Code passes this prompt to Bolt.

---

## BOLT INSTRUCTIONS

You are building the frontend for: {CLIENT_NAME}

The Next.js project is already initialized with:
- TypeScript configured
- Tailwind CSS configured
- shadcn/ui CSS variables in globals.css
- src/ directory structure
- axios API client at src/lib/axios.ts
- Utility function cn() at src/lib/utils.ts
- Types at src/types/index.ts

---

## WHAT TO BUILD

### 1. Public Website (if required)
- Landing page
- About / Services
- Contact form
- CTA buttons

### 2. Authentication Pages
- Login page (`/login`)
- Forgot password page (`/forgot-password`)
- Loading states, error messages

### 3. Dashboard Shell
- Root layout with sidebar + top header
- Sidebar navigation with all module links
- User profile dropdown
- Responsive: mobile drawer + desktop sidebar
- Breadcrumb component
- Page title component

### 4. Module Pages (empty shells — no API calls yet)
Create the page layout for each module with:
- Page header (title + action buttons)
- Data table placeholder (columns, empty state)
- Create/Edit modal or page placeholder
- Filter/search bar

### 5. Common Components
- DataTable (sortable, paginated)
- Modal / Dialog
- Form inputs (text, select, date, file upload)
- Status badges (color-coded)
- Confirmation dialog
- Toast notifications
- Loading spinner / skeleton
- Empty state component
- Pagination component

---

## DESIGN REQUIREMENTS

- Color theme: Professional blue/white (or per client brief)
- Font: Inter (already in layout.tsx)
- All pages must be responsive (mobile-first)
- Use shadcn/ui components throughout
- Use Tailwind CSS only — no inline styles
- Lucide React for icons
- Dark mode ready (CSS variables already set)

---

## WHAT NOT TO DO

- Do NOT create backend files
- Do NOT create API routes in Next.js (use axios to NestJS instead)
- Do NOT hardcode data — use empty states / loading placeholders
- Do NOT call real APIs yet (P004 will connect everything)
- Do NOT modify: src/lib/axios.ts, src/types/index.ts, next.config.ts

---

## FILE STRUCTURE TO FILL

```
frontend/src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── forgot-password/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx              ← sidebar + header shell
│   │   ├── dashboard/page.tsx      ← summary cards
│   │   ├── [module]/page.tsx       ← one per business module
│   │   └── profile/page.tsx
│   ├── layout.tsx                  ← already exists, do not change
│   └── page.tsx                    ← landing or redirect to login
├── components/
│   ├── ui/                         ← shadcn/ui components
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── Breadcrumb.tsx
│   └── common/
│       ├── DataTable.tsx
│       ├── Modal.tsx
│       ├── StatusBadge.tsx
│       ├── EmptyState.tsx
│       ├── LoadingSpinner.tsx
│       └── Pagination.tsx
└── constants/
    └── index.ts                    ← add ROUTES, NAV_ITEMS
```

---

## DELIVERABLE

When P002 is complete, report to ChatGPT:
1. Pages built (list)
2. Components built (list)
3. Build status (npm run build — must pass)
4. Screenshots if possible
5. Ready for P004 (Integration)

