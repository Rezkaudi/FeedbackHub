# R-79: small, built in steps, running as a normal user and not as root.
# R-144: this one image runs both the API and the worker; only the command differs.

# ---- build ------------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

# Dependencies first, so a code change does not re-download the world.
COPY apps/api/package*.json ./
RUN npm ci

COPY apps/api/prisma ./prisma
RUN npx prisma generate

COPY apps/api/tsconfig.json apps/api/tsconfig.build.json apps/api/nest-cli.json ./
COPY apps/api/src ./src
RUN npm run build

# Drop everything only needed to build.
RUN npm prune --omit=dev

# ---- run --------------------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app

# dumb-init gives us correct signal handling, so SIGTERM reaches Node and the
# graceful shutdown in main.ts and worker.ts actually runs.
RUN apk add --no-cache dumb-init

ENV NODE_ENV=production

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/package.json ./package.json

# R-79, R-102: a normal user. `node` already exists in the base image.
USER node

EXPOSE 3000

# The API. The worker overrides this with: node dist/worker.js (R-144).
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
