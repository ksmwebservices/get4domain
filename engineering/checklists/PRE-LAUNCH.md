# Pre-Launch Checklist — Get4Domain

Run through this checklist before promoting a client project to production
(`{client}.get4domain.com`).

## Code Quality

- [ ] `npm run build` passes with 0 errors (frontend + backend)
- [ ] `npm run lint` passes with 0 errors (frontend + backend)
- [ ] No `any` types remain
- [ ] No `console.log` in production code
- [ ] No dummy/placeholder data or TODO business logic

## Security

- [ ] All secrets loaded from environment variables, none hardcoded
- [ ] `.env` is not committed to the repository
- [ ] `helmet()`, CORS, and rate limiting are configured
- [ ] JWT secrets are strong, unique per environment, and rotated from any
      dev defaults
- [ ] Passwords are hashed with bcrypt, never stored or logged in plain text
- [ ] All endpoints require authentication unless explicitly `@Public()`
- [ ] Role-based access control is enforced on every protected route

## Database

- [ ] All migrations are applied and match the committed schema
- [ ] Soft delete (`deletedAt`) is implemented on every model that supports
      deletion
- [ ] Production database credentials differ from development/staging
- [ ] A backup strategy is in place (see `BACKUPS/` workspace convention)

## API

- [ ] Every endpoint returns the standard `ResponseInterceptor` shape
- [ ] Swagger docs are accurate and (if exposed) gated appropriately for the
      environment
- [ ] Pagination is implemented on all list endpoints

## Infrastructure

- [ ] Docker images build cleanly for production stage
- [ ] Nginx reverse proxy is configured with the correct domain and SSL
- [ ] Environment URLs follow the `{client}.get4domain.com` pattern
- [ ] Health check endpoint responds correctly behind the proxy

## Documentation

- [ ] `.env.example` reflects every required environment variable
- [ ] README is up to date with quick-start instructions
- [ ] Client has been informed of the payment/hosting terms per
      `docs/business/PAYMENT_POLICY.md`

## Sign-off

- [ ] ChatGPT (Business Analyst) has reviewed the delivered scope against the
      PRD
- [ ] Final payment (remaining 50%) has been confirmed before go-live
