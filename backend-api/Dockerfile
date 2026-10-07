FROM node:20-alpine AS base
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
# Persistent upload directories. Named volumes are mounted on both (docker-compose.yml); creating + chowning the
# directories first makes a NEW volume inherit the non-root user's ownership (an existing volume keeps its own).
#   /app/uploads          public images + rendered reels, served at /uploads/*  (UploadsController, ReelsService)
#   /app/private-uploads  payment-proof screenshots, admin-only streaming        (Commercial Engine)
RUN mkdir -p /app/uploads /app/private-uploads && chown -R nestjs:nodejs /app/uploads /app/private-uploads
USER nestjs
EXPOSE 3008
ENV PORT=3008
CMD ["node", "dist/src/main"]
