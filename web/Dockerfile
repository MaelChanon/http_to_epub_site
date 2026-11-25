
FROM node:22-bookworm-slim AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY api/package.json api/package.json
COPY web/package.json web/package.json
RUN npm ci

FROM deps AS builder
WORKDIR /repo
COPY api api
COPY web web
WORKDIR /repo/web
RUN npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
RUN npm install --global serve@14.2.8
WORKDIR /app
COPY --from=builder /repo/web/dist ./dist
USER node
EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000"]
