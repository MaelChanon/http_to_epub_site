
FROM node:22-bookworm-slim AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY api/package.json api/package.json
COPY web/package.json web/package.json
RUN npm ci

FROM deps AS api-builder
COPY api api
WORKDIR /repo/api
RUN npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=api-builder /repo/node_modules ./node_modules
COPY --from=api-builder /repo/package.json /repo/package-lock.json ./
COPY --from=api-builder /repo/api/package.json ./api/package.json
COPY --from=api-builder /repo/api/dist ./api/dist
COPY --from=api-builder /repo/api/node_modules ./api/node_modules
COPY --from=api-builder /repo/api/drizzle.config.ts ./api/drizzle.config.ts
COPY --from=api-builder /repo/api/drizzle ./api/drizzle
COPY --from=api-builder /repo/api/src/config.ts ./api/src/config.ts

WORKDIR /repo/api
USER node
EXPOSE 3000
CMD ["sh", "-c", "npm run db:migrate && node dist/src/index.js"]
