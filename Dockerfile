# ── Stage 1: Build React frontend ─────────────────────────────────────────
FROM node:18-alpine AS builder
WORKDIR /app

# PENTING: set development dulu agar devDependencies (vite) ikut terinstall
ENV NODE_ENV=development

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build
# Hasil build ada di /app/dist

# ── Stage 2: Production - Express serve everything ─────────────────────────
FROM node:18-alpine
WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

# Copy hasil build React dari stage 1
COPY --from=builder /app/dist ./dist

# Copy Express server
COPY server/ ./server/

EXPOSE 3000
CMD ["node", "server/index.js"]
