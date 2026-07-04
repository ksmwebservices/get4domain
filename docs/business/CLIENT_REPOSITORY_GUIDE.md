# Client Repository Guide — Get4Domain

## One Repository Per Client

Every client project lives in its own GitHub repository under
`github.com/ksmwebservices/{client-slug}` — never inside the `get4domain`
platform repository.

Naming convention: lowercase, kebab-case, with a numeric suffix for the
engagement, e.g. `mr-travels-001`, `hospital-001`.

## Local Layout

Client repos are cloned locally under:

```
CLIENT_PROJECTS\{CLIENT_ID}\
```

where `{CLIENT_ID}` is the upper-snake-case client identifier used across
`GET4DOMAIN_PLATFORM.json` and engineering prompts, e.g. `MR_TRAVELS_001`.

## What Belongs in a Client Repo

Everything specific to that client's application: `frontend/`, `backend/`,
`database/`, `deployment/`, `docs/`, `testing/`, `scripts/`, `uploads/`,
`logs/` — per the structure defined in `CLAUDE.md` section 5.

## What Never Goes in a Client Repo

- Engineering standards, phase prompts, or industry packs — those live only
  in the platform repo and are referenced, not copied.
- Other clients' code, credentials, or data.

## What Never Goes in the Platform Repo

- Client business logic, client-specific modules, or client data of any
  kind.
- Client secrets or environment files.

## Cross-Referencing

Client project READMEs may link back to the relevant
`engineering/industry-packs/{industry}/` docs in the platform repo for
context, but should not duplicate their content.
