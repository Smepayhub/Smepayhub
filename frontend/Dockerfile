# Multi-stage build for SMEHUB React / Vite frontend
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code and build production assets
COPY . .
RUN npm run build

# Stage 2: Pure Node.js Production Runtime (Dokploy & Traefik compatible, No Nginx)
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV BACKEND_URL=http://web:8000

# Copy package definition to preserve ES Modules configuration
COPY package.json ./

# Copy built production bundle and server.js
COPY --from=builder /app/dist ./dist
COPY server.js ./server.js

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:3000/healthz || exit 1

CMD ["node", "server.js"]

