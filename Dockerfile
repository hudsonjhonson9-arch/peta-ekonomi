# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS builder
WORKDIR /app
# NODE_ENV=development hanya selama install supaya devDependencies (vite)
# ikut terpasang. Saat build harus kembali production, kalau tidak bundle
# memuat React development build (jsxDEV + metadata fileName/lineNumber).
ENV NODE_ENV=development
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
ENV NODE_ENV=production
COPY . .
RUN NODE_OPTIONS="--max-old-space-size=1536" npm run build && npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY server/ ./server/
# Seed SQL dibaca server saat boot (jika pohon PKS masih kosong).
# Tanpa COPY ini file-nya tidak ada di image dan auto-seed akan gagal.
COPY db/ ./db/
USER node
EXPOSE 3000
CMD ["node", "server/index.js"]
