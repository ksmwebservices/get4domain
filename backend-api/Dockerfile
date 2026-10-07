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
# Private payment-proof screenshots (Commercial Engine). A named volume is mounted here (docker-compose.yml);
# creating + chowning the directory first makes the volume inherit the non-root user's ownership.
RUN mkdir -p /app/private-uploads && chown -R nestjs:nodejs /app/private-uploads
USER nestjs
EXPOSE 3008
ENV PORT=3008
CMD ["node", "dist/src/main"]
