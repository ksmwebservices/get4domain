# Client Onboarding Checklist — Get4Domain

Steps to take a new client from signed agreement to P001 kickoff.

## 1. Business Setup (ChatGPT + human)

- [ ] Signed SOW / agreement on file (`docs/agreements/`)
- [ ] 50% advance payment received
- [ ] Client questionnaire completed
      (`docs/onboarding/NEW_CLIENT_QUESTIONNAIRE.md`)
- [ ] PRD / BRD drafted by ChatGPT and approved by client
- [ ] Industry identified and matched to an existing
      `engineering/industry-packs/{industry}/` (or a new pack created)

## 2. Repository Setup

- [ ] New GitHub repository created:
      `github.com/ksmwebservices/{client-slug}`
- [ ] Client ID assigned (e.g. `MR_TRAVELS_001`)
- [ ] Repository added to `GET4DOMAIN_PLATFORM.json` under
      `activeClients`
- [ ] Local clone created under
      `CLIENT_PROJECTS\{CLIENT_ID}\`

## 3. Environment Planning

- [ ] Dev/staging/production URLs reserved following the
      `{client}[-env].get4domain.com` pattern
- [ ] Database names chosen for dev/staging/prod
- [ ] DNS entries planned (not yet created — done at P006)

## 4. Engineering Kickoff

- [ ] `CLAUDE.md` reviewed for anything client-specific to note
- [ ] P001 prompt filled in with client information and executed
- [ ] P002 (Bolt) and P003 (backend) kicked off in parallel once P001 is
      complete

## 5. Ongoing

- [ ] Client added to whatever support/communication channel is standard
- [ ] Annual hosting renewal date recorded
- [ ] AMC status (opted in / not) recorded
