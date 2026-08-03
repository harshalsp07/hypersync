FROM node:22-alpine AS build
RUN apk add --no-cache python3 make g++
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/config/package.json ./packages/config/
COPY apps/server/package.json ./apps/server/
RUN corepack enable && pnpm install --frozen-lockfile

COPY packages/shared/ ./packages/shared/
COPY packages/config/ ./packages/config/
COPY apps/server/ ./apps/server/
RUN pnpm --filter @hypersync/shared build && pnpm --filter @hypersync/server build

FROM node:22-alpine AS runtime
RUN apk add --no-cache tini
RUN addgroup -g 1001 -S app && adduser -S app -u 1001 -G app
WORKDIR /app

COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/server/package.json ./apps/server/
COPY --from=build /app/node_modules ./node_modules

USER app
EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/server/dist/index.js"]
