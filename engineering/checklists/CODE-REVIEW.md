# Code Review Checklist — Get4Domain v1.0

## General
- [ ] Follows naming conventions
- [ ] No business logic in controllers
- [ ] No HTTP concerns in services
- [ ] All DTOs have validation decorators
- [ ] No hardcoded values (use constants/config)

## Security
- [ ] Auth guards on protected routes
- [ ] Role checks on sensitive operations
- [ ] No SQL injection risk
- [ ] File upload validation

## Performance
- [ ] No N+1 queries (use Prisma includes)
- [ ] Pagination on list endpoints
- [ ] Proper indexes on filtered fields

## Documentation
- [ ] @ApiTags and @ApiOperation on controllers
- [ ] Complex logic has inline comments
