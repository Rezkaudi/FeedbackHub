/** A collision-proof suffix: two runs, two shards, two personas never clash. */
export function stamp(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
}

export function stampedTitle(prefix = 'E2E request'): string {
  return `${prefix} ${stamp()}`;
}

export function stampedName(prefix = 'e2e'): string {
  return `${prefix}-${stamp()}`;
}

/** `example.test` is not a real TLD anyone owns; safe for ephemeral accounts. */
export function stampedEmail(prefix = 'e2e'): string {
  return `${prefix}-${stamp()}@feedbackhub.test`;
}
