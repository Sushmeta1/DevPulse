# syntax=docker/dockerfile:1

# --- Stage 1: build the React dashboard -------------------------------------
FROM node:26-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- Stage 2: production-only backend dependencies --------------------------
FROM node:26-alpine AS backend-deps
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev

# --- Stage 3: runtime image -------------------------------------------------
FROM node:26-alpine
ENV NODE_ENV=production
WORKDIR /app

COPY --from=backend-deps /app/backend/node_modules backend/node_modules
COPY backend/ backend/
COPY database/ database/
COPY --from=frontend /app/frontend/dist frontend/dist

# Least privilege: run as the unprivileged "node" user shipped with the base image.
USER node
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-4000}/api/health" || exit 1

CMD ["node", "backend/server.js"]
