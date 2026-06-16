# ── Stage 1: Build React frontend ─────────────────────────────────────────
FROM node:18-alpine AS builder
WORKDIR /app

# Install semua dependency (termasuk express, pg, dll)
COPY package*.json ./
RUN npm ci

# Copy source dan build
COPY . .
RUN npm run build
# Hasil build ada di /app/dist

# ── Stage 2: Production (Express serve everything) ─────────────────────────
FROM node:18-alpine
WORKDIR /app

# Copy package.json dan install HANYA production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy hasil build React dari stage 1
COPY --from=builder /app/dist ./dist

# Copy Express server
COPY server/ ./server/

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "server/index.js"]
