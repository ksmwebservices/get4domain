# Client Repository Guide — Get4Domain v1.0

## When Starting a New Client

1. Collect requirements (industry questionnaire)
2. Create GitHub repo: github.com/ksmwebservices/{client-id}
3. Run P001 (Claude initializes project)
4. Run P002 (Bolt builds UI)
5. Run P003 (Claude builds backend)
6. Run P004 (Integration)
7. Run P005 (Testing)
8. Deploy to dev URL for client review
9. After approval + payment: Run P006 (Production deployment)

## Naming Convention

Client IDs:
  MR_TRAVELS_001    — M.R. Travels & Tours (first travel client)
  HOSPITAL_001      — First hospital client
  HR_001            — First HR client

GitHub repos:
  github.com/ksmwebservices/mr-travels-001
  github.com/ksmwebservices/hospital-001
  github.com/ksmwebservices/hr-001

Dev URLs:
  mr-travels-dev.get4domain.com
  hospital-dev.get4domain.com

Production URLs:
  mr-travels.get4domain.com  OR  client's own domain
