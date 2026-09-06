# GET4DOMAIN — Per-Vendor Subdomain Infrastructure Requirement
**Date:** 06 Sep 2026 · **Status:** REQUIREMENT ONLY — not implemented (VM/infra, needs KSM)
**Related:** PRD §4, §29 (per-vendor public presence on a Get4Domain subdomain)

## Goal
Serve every vendor's public site at **`<subdomain>.get4domain.com`** (e.g. `ksm-webtech-services.get4domain.com`) instead of the path form `get4domain.com/site/<subdomain>`.

## Current state
- The app serves vendor sites at the **path** `/site/[subdomain]` (Next route). Self-service signup currently redirects there.
- Specific subdomains already work in prod (`mrtravels.get4domain.com`, `allwintours.get4domain.com`) — so *some* subdomain serving exists, but it is **not confirmed to be a wildcard**, and new self-service vendors are **not** automatically reachable on their subdomain.
- There is **no host→path rewrite** in the Next app today.

## What's needed (three layers — all VM/infra, KSM)
1. **Wildcard DNS:** an `A`/`CNAME` record for `*.get4domain.com` pointing at the same server/load balancer as the frontend. (Leave the legacy MR-Travels 3000/3001 hosts untouched.)
2. **Wildcard TLS:** a wildcard certificate for `*.get4domain.com` (e.g. Let's Encrypt DNS-01, or the existing cert provider) installed on nginx.
3. **nginx:** route `*.get4domain.com` to the frontend container (`get4domain_frontend`, 3006), preserving the `Host` header so the app can read the subdomain.

## App-side change (small, deferred to a later dispatch — NOT in this pass)
Once the wildcard infra is confirmed, a **Next middleware host rewrite** maps the subdomain host to the existing route (no page rewrite needed elsewhere):
- If `Host` = `<sub>.get4domain.com` (and `<sub>` is not `www`/`app`/reserved) → internally **rewrite** to `/site/<sub>` (the current renderer is reused unchanged).
- Update self-service signup + dashboard links to present `https://<sub>.get4domain.com` as the canonical site URL.
- Keep `/site/<sub>` working as the internal target.

## Risks / notes
- Must not disturb the legacy MR-Travels stack (ports 3000/3001) or the existing `mrtravels`/`allwintours` hosts.
- Reserved subdomains (`www`, `app`, `api`/`gapi`, `admin`) must bypass the vendor rewrite.
- Verify Cloudflare (if fronting) also has the wildcard + proxied correctly, and purge cache after.

**Action for KSM:** provision layers 1–3 on the VM, confirm a test `<anything>.get4domain.com` resolves + serves the frontend, then a follow-up dispatch adds the ~1-day app middleware rewrite + link updates.
