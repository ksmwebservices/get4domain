# P002 — Frontend UI (Bolt)
# Get4Domain Engineering Standard v1.0
# Phase: P002 | Owner: Bolt | Runs parallel with P003 (Claude Code)

---

## OWNERSHIP NOTE

This phase is owned by **Bolt**, not Claude Code. Claude Code does not
write or redesign UI. This file exists in the platform repo so the handoff
is documented and so Claude Code (in P004) knows what to expect from Bolt's
output.

If Claude Code is asked to execute this phase directly, it should decline
UI implementation and instead confirm the P001 frontend foundation is in
place for Bolt to build on.

---

## INPUT BOLT NEEDS

1. `CLAUDE.md` section 2 — business context
2. The client PRD/BRD from ChatGPT
3. `engineering/industry-packs/{industry}/README.md` and `MODULE_LIST.md`
4. The P001 frontend foundation already committed to the client repo
   (`frontend/src/` structure, Tailwind + shadcn/ui configured)
5. Any brand assets in `assets/`

---

## WHAT BOLT BUILDS

- Public-facing site (marketing/landing pages as scoped by the PRD)
- Admin dashboard shell (navigation, layout, auth screens: login,
  forgot-password)
- Per-module UI screens (list/detail/create/edit) for every module in
  `MODULE_LIST.md`, wired to **placeholder data** only — no live API calls
  yet (that's P004)
- Responsive layout, using shadcn/ui components under
  `frontend/src/components/ui/`
- Shared layout components under `frontend/src/components/layout/`
- Shared reusable components under `frontend/src/components/common/`

## WHAT BOLT DOES NOT DO

- ❌ No backend code, no API routes, no database access
- ❌ No real authentication logic (screens only — logic wired in P004)
- ❌ No business logic beyond client-side form validation
- ❌ No modification of `backend/` or `engineering/` folders

---

## HANDOFF TO P004

When P002 is complete, Claude Code picks up in P004 and:

- Replaces placeholder data with real API calls via `services/api/`
- Wires real JWT auth (login/refresh/logout) into the auth screens Bolt
  built
- Connects `react-hook-form` + `zod` schemas to the real DTOs from P003

---

## DELIVERABLES (reported by Bolt)

```
P002 — FRONTEND UI COMPLETE
=============================

1. SCREENS BUILT: [list per module]
2. COMPONENTS: [count of shared/ui components added]
3. RESPONSIVE: mobile/tablet/desktop checked ✅/❌
4. BUILD STATUS: ✅/❌
5. READY FOR: P004 (Integration)
```
