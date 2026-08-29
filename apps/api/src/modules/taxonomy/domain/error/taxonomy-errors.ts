import { AppError, ErrorCode } from '../../../../shared/errors/app-error';

/**
 * What the taxonomy refuses, and why. Each one carries a message that says what
 * to do instead, because SRS 15.7 asks for exactly that: "Delete a used category
 * -> refused, offer to retire instead."
 */

export class CategoryInUseError extends AppError {
  public readonly code: ErrorCode = 'CONFLICT';
  public readonly httpStatus = 409;

  public constructor() {
    super('This category is used by requests, so it cannot be deleted. Retire it instead.');
  }
}

export class StatusInUseError extends AppError {
  public readonly code: ErrorCode = 'CONFLICT';
  public readonly httpStatus = 409;

  public constructor() {
    super('This status is used by requests, so it cannot be deleted. Retire it instead.');
  }
}

export class DuplicateNameError extends AppError {
  public readonly code: ErrorCode = 'CONFLICT';
  public readonly httpStatus = 409;

  public constructor(what: 'category' | 'status') {
    super(`Another ${what} already has that name.`);
  }
}

/**
 * R-48: the first status cannot be retired, and the last active category cannot
 * be retired. Otherwise nobody could write a request.
 */
export class DefaultStatusCannotBeRetiredError extends AppError {
  public readonly code: ErrorCode = 'CONFLICT';
  public readonly httpStatus = 409;

  public constructor() {
    super(
      'This is the status every new request starts in, so it cannot be retired. ' +
        'Make another status the first one, then retire this.',
    );
  }
}

export class LastActiveCategoryError extends AppError {
  public readonly code: ErrorCode = 'CONFLICT';
  public readonly httpStatus = 409;

  public constructor() {
    super('This is the only category left, so it cannot be retired. Add another one first.');
  }
}

export class DefaultStatusCannotBeUnsetError extends AppError {
  public readonly code: ErrorCode = 'CONFLICT';
  public readonly httpStatus = 409;

  public constructor() {
    super('Exactly one status must be the first one. Make another status the first one instead.');
  }
}

export class RetiredStatusCannotBeDefaultError extends AppError {
  public readonly code: ErrorCode = 'CONFLICT';
  public readonly httpStatus = 409;

  public constructor() {
    super('A retired status cannot be the one new requests start in. Bring it back first.');
  }
}
