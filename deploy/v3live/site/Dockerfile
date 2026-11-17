# The public Next site image, built from the PUBLIC SITE repo root (E1b). The repo's own Dockerfile has no ARG, but Next inlines NEXT_PUBLIC_* at BUILD time; this one adds them.
#   docker build -f <backend repo>/deploy/v3live/site/Dockerfile $(for n in ...; do echo --build-arg $n=...; done) -t get4domain-v3-site:<tag> .     (run in the site repo root; see RUNBOOK.md)
# Values are public by nature (addresses, public keys); none is written here. Server-only values come at run time (env/site.env.example).
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_SITE_BASE_DOMAIN
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_VENDOR_APP_URL
ARG NEXT_PUBLIC_RAZORPAY_KEY_ID
ARG NEXT_PUBLIC_VAPID_KEY
ARG NEXT_PUBLIC_GA_MEASUREMENT_ID
ARG NEXT_PUBLIC_PHONE
ARG NEXT_PUBLIC_EMAIL
ARG NEXT_PUBLIC_WHATSAPP
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 --ingroup nodejs nextjs
RUN mkdir -p /app/public
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3006
ENV PORT=3006
ENV HOSTNAME="0.0.0.0"
# Any answer below 500 means the server is up (the manifest route needs no API and no flag).
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3006)+'/manifest.webmanifest').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "server.js"]
