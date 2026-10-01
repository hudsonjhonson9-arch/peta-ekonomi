FROM node:18-alpine AS builder
WORKDIR /app
# NODE_ENV=development hanya selama install supaya devDependencies (vite)
# ikut terpasang. Saat build harus kembali production, kalau tidak bundle
# memuat React development build (jsxDEV + metadata fileName/lineNumber).
ENV NODE_ENV=development
COPY package*.json ./
RUN npm install
ENV NODE_ENV=production
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
COPY server/ ./server/
# Seed SQL dibaca server saat boot (jika pohon PKS masih kosong).
# Tanpa COPY ini file-nya tidak ada di image dan auto-seed akan gagal.
COPY db/ ./db/
EXPOSE 3000
CMD ["node", "server/index.js"]
