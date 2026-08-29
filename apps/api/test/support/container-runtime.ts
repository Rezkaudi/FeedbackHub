/**
 * Testcontainers assumes a Docker daemon. This machine runs podman emulating
 * docker, where the socket is not at the path Testcontainers probes and Ryuk
 * (its reaper) cannot run rootless.
 *
 * So: if the developer has not chosen a runtime themselves, and a rootless
 * podman socket is there, point at it. We never override an explicit choice,
 * and on a real Docker machine this file does nothing.
 *
 * See DECISIONS.md D-23.
 */
import { existsSync } from 'node:fs';

const podmanSocket = `/run/user/${process.getuid?.() ?? 1000}/podman/podman.sock`;

if (!process.env.DOCKER_HOST && existsSync(podmanSocket)) {
  process.env.DOCKER_HOST = `unix://${podmanSocket}`;
  // Ryuk needs a privileged container it cannot get from a rootless socket.
  // Containers are stopped explicitly in afterAll instead.
  process.env.TESTCONTAINERS_RYUK_DISABLED = 'true';
}
