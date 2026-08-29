/**
 * Time comes in as a port, so a business rule is testable with no clock (R-152).
 * A use case that calls `new Date()` itself cannot be tested for "one window
 * after their oldest attempt" (R-131) without sleeping.
 */
export interface Clock {
  now(): Date;
}

export const CLOCK = Symbol('Clock');

export class SystemClock implements Clock {
  public now(): Date {
    return new Date();
  }
}

/** For tests: a clock that stands still until it is told to move. */
export class FixedClock implements Clock {
  public constructor(private current: Date) {}

  public now(): Date {
    return this.current;
  }

  public set(moment: Date): void {
    this.current = moment;
  }

  public advanceMinutes(minutes: number): void {
    this.current = new Date(this.current.getTime() + minutes * 60_000);
  }
}
