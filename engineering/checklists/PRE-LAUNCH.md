# Pre-Launch Checklist — Get4Domain v1.0

## Code Quality
- [ ] All TypeScript errors resolved
- [ ] ESLint passing (0 errors)
- [ ] Build successful (frontend + backend)
- [ ] All unit tests passing
- [ ] No console.log in production code
- [ ] No hardcoded secrets

## Security
- [ ] .env.local not committed
- [ ] JWT secrets are strong (32+ chars)
- [ ] CORS configured for production domain only
- [ ] Helmet enabled
- [ ] Rate limiting configured
- [ ] Input validation on all endpoints

## Database
- [ ] All migrations applied
- [ ] Seed data verified
- [ ] Backup configured
- [ ] Connection pooling configured

## Deployment
- [ ] Docker build successful
- [ ] Nginx configured
- [ ] SSL certificate installed
- [ ] Health check endpoint responding
- [ ] Environment variables set in production
- [ ] Domain pointing to server

## Client
- [ ] Client review done on dev URL
- [ ] Final approval received in writing
- [ ] Full payment received
- [ ] Admin credentials handed over
- [ ] Basic training completed
