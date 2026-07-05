# Get4Domain Platform Architecture — v1.0

## Platform Structure

GET4DOMAIN (this repo) — Company platform
  Not for client code. Contains standards, docs, future portal.

CLIENT_PROJECTS (separate repos)
  Each client = separate GitHub repository
  Example: github.com/ksmwebservices/mr-travels-001

## Standard Deployment

client-dev.get4domain.com     — Development review
client.get4domain.com         — Production (after full payment)

## Module Boundaries

Platform modules (this repo):
  auth, users, clients, projects, invoices, payments, hosting

Client-specific modules (client repos):
  Defined per industry pack (travel, hospital, hr, etc.)

## Data Isolation
  Each client has a separate PostgreSQL database.
  Cross-client data access is strictly prohibited.
