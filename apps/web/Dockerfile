FROM node:22-alpine AS build
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/config/package.json ./packages/config/
COPY apps/web/package.json ./apps/web/
RUN corepack enable && pnpm install --frozen-lockfile

COPY packages/shared/ ./packages/shared/
COPY packages/config/ ./packages/config/
COPY apps/web/ ./apps/web/
RUN pnpm --filter @hypersync/shared build && pnpm --filter @hypersync/web build

FROM nginx:alpine AS runtime
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
