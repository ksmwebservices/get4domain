# The V3 LIVE API image, built from the REPOSITORY ROOT (E1b). Why not backend-api/Dockerfile.v3live: its build context is backend-api, which cannot see ../themes,
# and `npm run build` runs scripts/build-renderer.js, which reads ../themes. This file is the same image with the repository root as the context.
#   docker build -f deploy/v3live/api/Dockerfile --target runner -t get4domain-v3-api:<tag> .     (run in the backend repo root)
#   docker build -f deploy/v3live/api/Dockerfile --target ops    -t get4domain-v3-ops:<tag> .     (migrate, baseline, seed, bootstrap, backup)
# BuildKit reads the allow-list in Dockerfile.dockerignore next to this file. No secret and no real value is built in.

FROM node:20-alpine AS deps
WORKDIR /repo/backend-api
RUN apk add --no-cache openssl
COPY backend-api/package.json backend-api/package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /repo
RUN apk add --no-cache openssl
COPY --from=deps /repo/backend-api/node_modules ./backend-api/node_modules
COPY backend-api ./backend-api
COPY themes ./themes
WORKDIR /repo/backend-api
# prisma generate + nest build + the theme renderer (reads ../themes)
RUN npm run build

# Operator image: everything the live scripts need (Prisma CLI, the scripts, the built startup check) plus the PostgreSQL client tools and openssl.
FROM builder AS ops
RUN apk add --no-cache postgresql17-client openssl
USER node
CMD ["sh"]

FROM node:20-alpine AS prod-deps
WORKDIR /app
RUN apk add --no-cache openssl
COPY backend-api/package.json backend-api/package-lock.json ./
COPY backend-api/prisma ./prisma
RUN npm ci --omit=dev --ignore-scripts
COPY --from=builder /repo/backend-api/node_modules/.prisma ./node_modules/.prisma

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl tini
ENV NODE_ENV=production
ENV V3_LIVE=true
ENV PORT=3008
ENV HOST=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 --ingroup nodejs nestjs
COPY --from=prod-deps --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /repo/backend-api/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /repo/backend-api/package.json ./package.json
COPY --from=builder --chown=nestjs:nodejs /repo/backend-api/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /repo/backend-api/scripts ./scripts
RUN mkdir -p /app/uploads /app/private-uploads && chown -R nestjs:nodejs /app/uploads /app/private-uploads
USER nestjs
EXPOSE 3008
# Liveness only (no database call). Node's built-in fetch: no curl or wget in the image.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3008)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/src/main"]
