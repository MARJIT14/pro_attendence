# ─────────────────────────────────────────────
# Pro Attendance — Multi-stage Docker Build
# ─────────────────────────────────────────────

# ── Stage 1: Build React frontend ────────────
FROM node:18-alpine AS client-build
WORKDIR /app/client
COPY client/package.json ./
RUN npm install
COPY client/public ./public
COPY client/src ./src
RUN npm run build

# ── Stage 2: Build & run server ──────────────
FROM node:18-alpine
WORKDIR /app

# Copy server dependencies
COPY server/package.json ./server/
RUN cd server && npm install --production

# Copy server source code
COPY server/ ./server/

# Copy built React app to serve statically
COPY --from=client-build /app/client/build ./client/build

# Environment defaults
ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

# Start the server
CMD ["node", "server/server.js"]

