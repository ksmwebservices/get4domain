# New Client Questionnaire — Get4Domain

Filled in by ChatGPT (Business Analyst) during initial client discovery,
before P001 starts.

## Business Basics

1. Business/company name?
2. Industry (match to an existing pack in `engineering/industry-packs/` or
   flag as new)?
3. Primary location(s) and any region-specific regulatory requirements
   (e.g. GST for India)?
4. Number of expected users (admin/staff) and roles?
5. Number of expected end-customers (if the app is customer-facing)?

## Scope

6. What are the must-have modules for launch (MVP)?
7. What is explicitly out of scope for MVP?
8. Any existing system being replaced or integrated with?
9. Any required third-party integrations (payments, SMS, email, maps)?

## Branding & UI

10. Do they have existing brand assets (logo, colors)? Where are they
    stored (`assets/`)?
11. Any reference sites/apps they like the look of? (for Bolt/P002)

## Data

12. Is there existing data to migrate? Format and volume?
13. Any data residency/privacy requirements?

## Commercial

14. Agreed implementation fee and payment schedule (50/50 default)?
15. Agreed annual hosting fee?
16. AMC opted in?
17. Source code delivery contracted separately? (default: no)

## Technical

18. Desired dev/staging/prod subdomain slugs (client-slug for
    `{slug}[-env].get4domain.com`)?
19. Any hard deadline driving the timeline?

## Output

Once this questionnaire is complete, ChatGPT drafts the PRD/BRD and hands
off to Claude Code for P001.
