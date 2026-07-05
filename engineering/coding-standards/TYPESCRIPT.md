# TypeScript Standards — Get4Domain v1.0

## Rules
- strict: true always
- No any — use unknown or define proper types
- Always type return values on public methods
- Use interface for object shapes, type for unions

## File Naming
- Services:     auth.service.ts
- Controllers:  auth.controller.ts
- Modules:      auth.module.ts
- DTOs:         create-user.dto.ts
- Guards:       jwt-auth.guard.ts
- Strategies:   jwt.strategy.ts

## Import Order
1. Node built-ins
2. External packages
3. Internal absolute (@/...)
4. Relative imports
