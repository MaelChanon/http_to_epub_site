
FROM node:22-bookworm-slim AS deps
WORKDIR /repo
COPY package.json package-lock.json .npmrc ./
COPY api/package.json api/package.json
COPY web/package.json web/package.json
COPY manga-fetcher/package.json manga-fetcher/package.json
RUN npm ci

FROM deps AS builder
WORKDIR /repo
COPY manga-fetcher/tsconfig.json manga-fetcher/tsconfig.json
COPY manga-fetcher/src manga-fetcher/src
RUN npx tsc -p manga-fetcher/tsconfig.json
COPY api api
COPY web web
WORKDIR /repo/web
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY --from=builder /repo/web/dist /usr/share/nginx/html
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
