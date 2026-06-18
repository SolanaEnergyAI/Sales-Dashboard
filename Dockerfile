# Solana Energy Sales Dashboard — single-image build.
# Builds the React frontend, then runs the Express API which also serves it.

# ---- build stage ----
FROM node:22-alpine AS build
WORKDIR /app
# Install deps (uses workspace lockfile)
COPY package*.json ./
COPY server/package.json ./server/
COPY web/package.json ./web/
RUN npm install
# Build the frontend into web/dist
COPY . .
RUN npm run build

# ---- runtime stage ----
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server ./server
COPY --from=build /app/web/package.json ./web/package.json
COPY --from=build /app/web/dist ./web/dist
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD wget -qO- http://localhost:4000/api/health || exit 1
CMD ["node", "server/src/index.js"]
