FROM node:22-alpine AS base
RUN apk add --no-cache python3 make g++
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
RUN corepack enable && pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY . .
RUN corepack enable && pnpm --filter @hypersync/shared build
RUN corepack enable && pnpm --filter @hypersync/server build

FROM node:22-alpine AS runtime
RUN apk add --no-cache tini
WORKDIR /app
RUN addgroup -g 1001 -S app && adduser -S app -u 1001 -G app

COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/server/package.json ./apps/server/
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/node_modules ./packages/shared/node_modules

USER app
EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/server/dist/index.js"]
