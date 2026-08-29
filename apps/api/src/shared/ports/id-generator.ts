import { randomUUID } from 'node:crypto';

/**
 * Randomness comes in as a port for the same reason time does (R-152): a use
 * case that generates its own ids cannot be asserted against a known value.
 */
export interface IdGenerator {
  next(): string;
}

export const ID_GENERATOR = Symbol('IdGenerator');

export class UuidGenerator implements IdGenerator {
  public next(): string {
    return randomUUID();
  }
}

/** For tests: hands out ids in a known order, then falls back to real ones. */
export class SequenceIdGenerator implements IdGenerator {
  private index = 0;

  public constructor(private readonly ids: readonly string[]) {}

  public next(): string {
    const id = this.ids[this.index];
    this.index += 1;
    return id ?? randomUUID();
  }
}
