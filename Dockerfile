# Multi-stage Dockerfile for Next.js Standalone
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssh-client git curl python3 docker-cli docker-cli-compose

# Dependencies stage
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# Builder stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# Runner stage
FROM base AS runner
ARG BUILD_REVISION=unknown
LABEL org.opencontainers.image.revision="$BUILD_REVISION"
WORKDIR /app
RUN apk add --no-cache curl python3 docker-cli git
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/scripts/backup-engine.cjs /app/scripts/backup-engine.cjs
COPY --from=builder /app/scripts/hub-identity.cjs /app/scripts/hub-identity.cjs
COPY --from=builder /app/scripts/recover-owner.cjs /app/scripts/recover-owner.cjs
COPY --from=builder /app/scripts/job-store.cjs /app/scripts/job-store.cjs
COPY --from=builder /app/scripts/backup-runner.cjs /app/scripts/backup-runner.cjs
COPY --from=builder /app/scripts/recovery-engine.cjs /app/scripts/recovery-engine.cjs
COPY --from=builder /app/scripts/restore-evidence.cjs /app/scripts/restore-evidence.cjs
COPY --from=builder /app/scripts/restore-sandbox.cjs /app/scripts/restore-sandbox.cjs
COPY --from=builder /app/scripts/recovery-runner.cjs /app/scripts/recovery-runner.cjs
COPY --from=builder /app/scripts/backup-import.cjs /app/scripts/backup-import.cjs
COPY --from=builder /app/scripts/import-runner.cjs /app/scripts/import-runner.cjs
COPY --from=builder /app/scripts/backup-scheduler.cjs /app/scripts/backup-scheduler.cjs
COPY --from=builder /app/scripts/backup-scheduler-health.cjs /app/scripts/backup-scheduler-health.cjs
COPY --from=builder /app/scripts/release-catalog.cjs /app/scripts/release-catalog.cjs
COPY --from=builder /app/scripts/release-engine.cjs /app/scripts/release-engine.cjs
COPY --from=builder /app/scripts/release-worker.cjs /app/scripts/release-worker.cjs
COPY --from=builder /app/scripts/release-worker-health.cjs /app/scripts/release-worker-health.cjs
COPY --from=builder /app/scripts/image-maintenance.cjs /app/scripts/image-maintenance.cjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
