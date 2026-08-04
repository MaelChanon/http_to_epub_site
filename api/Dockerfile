
FROM node:22-bookworm-slim AS deps
WORKDIR /repo
COPY package.json package-lock.json .npmrc ./
COPY api/package.json api/package.json
COPY web/package.json web/package.json
COPY manga-fetcher/package.json manga-fetcher/package.json
RUN npm ci

FROM deps AS rust-builder
RUN apt-get update && apt-get install -y --no-install-recommends \
		build-essential \
		pkg-config \
		libssl-dev \
		curl \
		ca-certificates \
	&& rm -rf /var/lib/apt/lists/*
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
		| sh -s -- -y --profile minimal --default-toolchain stable
ENV PATH="/root/.cargo/bin:${PATH}"
COPY http_to_epub http_to_epub
COPY manga-fetcher manga-fetcher
WORKDIR /repo/manga-fetcher
RUN npm run build

FROM rust-builder AS api-builder
WORKDIR /repo
COPY api api
WORKDIR /repo/api
RUN npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=api-builder /repo/node_modules ./node_modules
COPY --from=api-builder /repo/package.json /repo/package-lock.json ./
COPY --from=api-builder /repo/manga-fetcher/package.json ./manga-fetcher/package.json
COPY --from=api-builder /repo/manga-fetcher/index.node ./manga-fetcher/index.node
COPY --from=api-builder /repo/manga-fetcher/lib ./manga-fetcher/lib
COPY --from=api-builder /repo/api/package.json ./api/package.json
COPY --from=api-builder /repo/api/dist ./api/dist

WORKDIR /repo/api
USER node
EXPOSE 3000
CMD ["node", "dist/src/index.js"]
