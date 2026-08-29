import { AppError, ErrorCode } from '../../../../shared/errors/app-error';

/**
 * Why someone may not join, or may not leave.
 *
 * The wording matters here more than usual. SRS 15.8 draws a line between "you
 * are not allowed to join" and "you were unlucky with the timing" — the second
 * must say to try later, because the person *is* allowed, and telling them
 * otherwise would be false.
 */

/** R-67: the sign-up rule said no. This is permanent until an admin changes it. */
export class SignupNotAllowed extends AppError {
  public readonly code: ErrorCode = 'SIGNUP_NOT_ALLOWED';
  public readonly httpStatus = 403;

  public constructor(
    message: string,
    /** For the log and for the screen, so it can explain the right thing. */
    public readonly reason: 'policy_invite_only' | 'policy_domain' | 'email_not_verified',
  ) {
    super(message);
  }
}

/** R-62: the app must never be left with nobody who can run it. */
export class LastAdminCannotLeaveError extends AppError {
  public readonly code: ErrorCode = 'CONFLICT';
  public readonly httpStatus = 409;

  public constructor() {
    super(
      'You are the only admin, so this account cannot be deleted. ' +
        'Make someone else an admin first.',
    );
  }
}
