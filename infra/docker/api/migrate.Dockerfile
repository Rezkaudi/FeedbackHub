# R-82: database changes run as their own step that finishes before the app
# starts. Never while the app is starting, because two copies would fight.
#
# Same base as the API image so the Prisma versions cannot drift.
FROM node:22-alpine
WORKDIR /app

RUN apk add --no-cache dumb-init

COPY apps/api/package*.json ./
RUN npm ci

COPY apps/api/prisma ./prisma
COPY apps/api/tsconfig.json ./
RUN npx prisma generate

USER node

ENTRYPOINT ["dumb-init", "--"]
# Migrate, then load the example data. The seed is safe to run again (R-120),
# and `&&` means a failed migration never reaches the seed.
CMD ["sh", "-c", "npx prisma migrate deploy && npx ts-node prisma/seed/seed.ts"]
