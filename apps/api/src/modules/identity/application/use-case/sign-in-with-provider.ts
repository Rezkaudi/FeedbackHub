import { Inject, Injectable } from '@nestjs/common';
import { IDENTITY_PROVIDER, IdentityProvider, USER_REPOSITORY, UserRepository } from '../port/user-repository';
import { User } from '../../domain/entity/user';
import { checkMayJoin } from '../../domain/entity/registration-rule';
import { SettingsService } from '../../../settings/settings.service';
import { InvitationsService } from '../../../invitations/invitations.service';
import { CLOCK, type Clock, ID_GENERATOR, type IdGenerator } from '../../../../shared/ports';

/**
 * R-4: the first time a person signs in, the server makes a local record — but
 * only after checking the sign-up rule (R-67) and that the sign-up limit has
 * room (R-130). If either says no, no record is made.
 *
 * The order matters and is deliberate:
 *
 *   1. the token is checked (R-5) — done by the caller, which has the token;
 *   2. already known? then just refresh what may have gone stale and return.
 *      Changing the sign-up rule never removes people who already got in
 *      (SRS part 14), so an existing person is never re-checked against it;
 *   3. the sign-up *rule* — a permanent no;
 *   4. the sign-up *limit* — a "try later", checked last and inside the same
 *      database step as the insert, so it cannot be raced (R-132).
 *
 * Steps 3 and 4 give different messages on purpose (SRS 15.8): someone refused
 * by the limit is allowed to join, they were only unlucky with the timing.
 */
@Injectable()
export class SignInWithProvider {
  public constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(IDENTITY_PROVIDER) private readonly provider: IdentityProvider,
    private readonly settings: SettingsService,
    private readonly invitations: InvitationsService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  public async execute(accessToken: string): Promise<User> {
    const claims = await this.provider.verifyAccessToken(accessToken);

    const known = await this.users.findByExternalId(claims.subject);
    if (known !== null) {
      known.refreshFromProvider({
        email: claims.email,
        emailVerified: claims.emailVerified,
        displayName: claims.displayName,
      });
      return this.users.save(known);
    }

    const appSettings = await this.settings.appSettings();

    checkMayJoin(
      { email: claims.email, emailVerified: claims.emailVerified },
      {
        policy: appSettings.registrationPolicy,
        allowedDomains: appSettings.allowedEmailDomains,
        hasInvitation: await this.invitations.hasOpenInvitationFor(claims.email),
      },
    );

    const user = User.createFromProvider(
      {
        externalId: claims.subject,
        email: claims.email,
        emailVerified: claims.emailVerified,
        displayName: claims.displayName,
        avatarUrl: claims.avatarUrl ?? null,
      },
      this.ids.next(),
    );

    const created = await this.users.createWithinSignupLimit(
      user,
      appSettings.signupLimit,
      this.clock.now(),
    );

    // R-4: an invitation is used up only once the person really exists.
    await this.invitations.markAccepted(created.email, this.clock.now());

    return created;
  }
}
