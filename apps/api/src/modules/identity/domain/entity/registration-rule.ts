import { SignupNotAllowed } from '../error/identity-errors';

/**
 * R-67: the admin sets the sign-up rule — open to everybody, invite only, or
 * only these email domains.
 *
 * A pure decision with no database and no clock (R-152), so every branch is
 * cheap to test. The two facts it needs — is this email on the invite list, and
 * is it verified — are passed in; looking them up is the use case's job.
 *
 * The one subtle rule: **only a checked email counts for the domain rule**. An
 * unchecked email is a claim, not a fact, and anyone can claim to be
 * someone@example.com. The refusal says email checking is the reason, because
 * "your domain is wrong" would be a lie and unhelpful.
 */
export type RegistrationPolicy = 'open' | 'invite_only' | 'domain_restricted';

export interface JoiningPerson {
  readonly email: string;
  readonly emailVerified: boolean;
}

export interface RegistrationRule {
  readonly policy: RegistrationPolicy;
  readonly allowedDomains: readonly string[];
  readonly hasInvitation: boolean;
}

function domainOf(email: string): string {
  return email.slice(email.lastIndexOf('@') + 1).toLowerCase();
}

/** Throws SignupNotAllowed, or returns cleanly. */
export function checkMayJoin(person: JoiningPerson, rule: RegistrationRule): void {
  switch (rule.policy) {
    case 'open':
      return;

    case 'invite_only':
      if (!rule.hasInvitation) {
        throw new SignupNotAllowed(
          'This board is invite only, and there is no invitation for this address.',
          'policy_invite_only',
        );
      }
      return;

    case 'domain_restricted': {
      if (!person.emailVerified) {
        throw new SignupNotAllowed(
          'Your email address has not been checked yet, so we cannot confirm your company.',
          'email_not_verified',
        );
      }

      if (!rule.allowedDomains.includes(domainOf(person.email))) {
        throw new SignupNotAllowed(
          'This board is open only to people from the company email domains.',
          'policy_domain',
        );
      }
      return;
    }
  }
}
