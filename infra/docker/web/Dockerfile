# R-79: small, built in steps, running as a normal user and not as root.
#
# The front end is static files. There is no Node process at runtime and no
# server-side rendering (D-37) — nginx serves the build and proxies the API.

# Base images are written in full, with the registry. Docker fills in
# `docker.io/` for a short name; podman refuses to guess unless the machine has
# an unqualified-search registry configured, and the build stops. Writing it out
# costs nothing on Docker and makes the same file work on both.

# ---- build ------------------------------------------------------------------
FROM docker.io/node:22-alpine AS build
WORKDIR /app

# Dependencies first, so a code change does not re-download the world.
COPY apps/web/package*.json ./
RUN npm ci

COPY apps/web/angular.json apps/web/tsconfig*.json apps/web/.postcssrc.json ./
COPY apps/web/public ./public
COPY apps/web/src ./src
RUN npm run build

# ---- run --------------------------------------------------------------------
# The unprivileged image listens on 8080 as the `nginx` user rather than on 80
# as root, which is what R-79 asks for without us having to unpick the default
# image's permissions by hand.
FROM docker.io/nginxinc/nginx-unprivileged:1.27-alpine AS runtime

COPY --chown=nginx:nginx infra/docker/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build --chown=nginx:nginx /app/dist/web/browser /usr/share/nginx/html

EXPOSE 8080
