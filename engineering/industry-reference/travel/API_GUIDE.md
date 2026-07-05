# Travel & Tours — API Guide
# Get4Domain Engineering Standard v1.0
# Status: TEMPLATE — Verify and expand after MR_TRAVELS_001 P003 is complete

---

## Base URL

```
Development:  http://localhost:3001/api/v1
Production:   https://{client-domain}/api/v1
Swagger:      http://localhost:3001/api/docs  (dev only)
```

---

## Standard Response Format

All responses use the global ResponseInterceptor:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Success",
  "data": {},
  "timestamp": "2025-07-04T00:00:00.000Z"
}
```

Error response:
```json
{
  "success": false,
  "statusCode": 404,
  "message": "Booking not found",
  "timestamp": "2025-07-04T00:00:00.000Z",
  "path": "/api/v1/bookings/abc-123",
  "method": "GET"
}
```

---

## Authentication

```
Header: Authorization: Bearer {accessToken}
Token expiry: 15 minutes
Refresh: POST /api/v1/auth/refresh  { refreshToken: "..." }
```

---

## Pagination (all list endpoints)

Query params: `?page=1&limit=10&search=text&sortBy=createdAt&sortOrder=desc`

Response data shape for lists:
```json
{
  "data": [...],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 10,
    "totalPages": 10,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

---

## Endpoint Reference

### Auth
```
POST   /auth/login              Public
POST   /auth/refresh            Public
POST   /auth/logout             JWT required
GET    /auth/me                 JWT required
```

### Users
```
GET    /users                   ADMIN, MANAGER
POST   /users                   ADMIN
GET    /users/:id               ADMIN, MANAGER
PATCH  /users/:id               ADMIN
DELETE /users/:id               ADMIN (soft delete)
PATCH  /users/:id/status        ADMIN
```

### Packages
```
GET    /packages                All roles
POST   /packages                ADMIN, MANAGER
GET    /packages/:id            All roles
PATCH  /packages/:id            ADMIN, MANAGER
DELETE /packages/:id            ADMIN
```

### Vehicles
```
GET    /vehicles                ADMIN, MANAGER, STAFF
POST   /vehicles                ADMIN
GET    /vehicles/:id            ADMIN, MANAGER, STAFF
PATCH  /vehicles/:id            ADMIN, MANAGER
DELETE /vehicles/:id            ADMIN
PATCH  /vehicles/:id/status     ADMIN, MANAGER
```

### Drivers
```
GET    /drivers                 ADMIN, MANAGER, STAFF
POST   /drivers                 ADMIN
GET    /drivers/:id             ADMIN, MANAGER, STAFF
PATCH  /drivers/:id             ADMIN, MANAGER
DELETE /drivers/:id             ADMIN
PATCH  /drivers/:id/status      ADMIN, MANAGER
GET    /drivers/:id/trips       ADMIN, MANAGER
```

### Bookings
```
GET    /bookings                ADMIN, MANAGER, STAFF
POST   /bookings                ADMIN, MANAGER, STAFF
GET    /bookings/:id            ADMIN, MANAGER, STAFF
PATCH  /bookings/:id            ADMIN, MANAGER
DELETE /bookings/:id            ADMIN
POST   /bookings/:id/confirm    ADMIN, MANAGER
POST   /bookings/:id/assign     ADMIN, MANAGER
POST   /bookings/:id/cancel     ADMIN, MANAGER
```

### Trip Sheets
```
GET    /tripsheets              ADMIN, MANAGER
POST   /tripsheets              ADMIN, MANAGER, STAFF
GET    /tripsheets/:id          ADMIN, MANAGER, STAFF
PATCH  /tripsheets/:id          ADMIN, MANAGER
POST   /tripsheets/:id/start    ADMIN, MANAGER
POST   /tripsheets/:id/close    ADMIN, MANAGER
```

### Corporate
```
GET    /corporate-clients       ADMIN, MANAGER
POST   /corporate-clients       ADMIN
GET    /corporate-clients/:id   ADMIN, MANAGER
PATCH  /corporate-clients/:id   ADMIN
GET    /corporate-clients/:id/contracts       ADMIN, MANAGER
POST   /corporate-clients/:id/contracts       ADMIN
PATCH  /corporate-clients/:id/contracts/:cid  ADMIN
```

### Invoices
```
GET    /invoices                ADMIN, MANAGER
POST   /invoices                ADMIN, MANAGER
GET    /invoices/:id            ADMIN, MANAGER
POST   /invoices/generate       ADMIN, MANAGER
GET    /invoices/:id/pdf        ADMIN, MANAGER
PATCH  /invoices/:id/paid       ADMIN
DELETE /invoices/:id            ADMIN
```

### Accounts
```
GET    /accounts                ADMIN, MANAGER
POST   /accounts                ADMIN, MANAGER
GET    /accounts/:id            ADMIN, MANAGER
PATCH  /accounts/:id            ADMIN
DELETE /accounts/:id            ADMIN
GET    /accounts/summary        ADMIN, MANAGER
```

### Reports
```
GET    /reports/bookings        ADMIN, MANAGER
GET    /reports/revenue         ADMIN, MANAGER
GET    /reports/vehicles        ADMIN, MANAGER
GET    /reports/drivers         ADMIN, MANAGER
GET    /reports/corporate       ADMIN, MANAGER
```

---

## Notes (fill after MR_TRAVELS_001 P003)

- [ ] Document any endpoint additions made during implementation
- [ ] Document any DTO validation patterns worth reusing
- [ ] Add rate limiting notes per endpoint category
- [ ] Note any PDF generation library used for invoices
