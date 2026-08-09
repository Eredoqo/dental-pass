# Dental Passport backend image — runs the API by default, the worker with WORKER=1
# (Stage 3 §9: "second container, same image with WORKER=1").
# The web app is NOT in this image: it builds to static files for Vercel/Netlify.

FROM node:22-slim AS builder
# openssl so prisma generate detects the right engine target
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app

# Install with a stable layer cache: manifests first, sources after.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
# web manifest is needed so the workspace resolves, but its deps are excluded below
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter '!@dental-passport/web'

COPY packages ./packages
COPY apps/api ./apps/api
COPY apps/worker ./apps/worker

# prisma generate runs inside packages/db build; the engine is compiled for
# this same base image, so the runtime stage below must use the same base.
RUN pnpm --filter @dental-passport/shared build \
 && pnpm --filter @dental-passport/db build \
 && pnpm --filter @dental-passport/api build \
 && pnpm --filter @dental-passport/worker build

FROM node:22-slim
# Prisma needs openssl at runtime on slim images.
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production

# pnpm layout: each package's node_modules holds symlinks into the root
# node_modules/.pnpm store, so app directories must be copied whole.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api ./apps/api
COPY --from=builder /app/apps/worker ./apps/worker

EXPOSE 3001
CMD ["sh", "-c", "if [ \"$WORKER\" = \"1\" ]; then node apps/worker/dist/main.js; else node apps/api/dist/main.js; fi"]
