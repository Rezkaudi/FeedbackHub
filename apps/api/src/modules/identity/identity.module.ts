import { Global, Module } from '@nestjs/common';
import { AuthController } from './http/auth.controller';
import { ProfileController } from './http/profile.controller';
import { IdentityService } from './identity.service';
import { IDENTITY_PROVIDER, USER_REPOSITORY } from './application/port/user-repository';
import { PrismaUserRepository } from './infrastructure/persistence/prisma-user.repository';
import { KeycloakIdentityProvider } from './infrastructure/oidc/keycloak-identity-provider';
import { CookieCurrentUserSource } from './infrastructure/http/cookie-current-user-source';
import { CURRENT_USER_SOURCE } from '../../shared/auth/authenticated-user';
import { SignInWithProvider } from './application/use-case/sign-in-with-provider';
import { ResolveCurrentUser } from './application/use-case/resolve-current-user';
import { ReadMyProfile } from './application/use-case/read-my-profile';
import { ChangeMyProfile } from './application/use-case/change-my-profile';
import { DeleteMyAccount } from './application/use-case/delete-my-account';
import { SettingsModule } from '../settings/settings.module';
import { InvitationsModule } from '../invitations/invitations.module';

/**
 * Owns the `users` table, and owns our whole relationship with Keycloak (R-1).
 *
 * It exports two things: IdentityService for other modules (R-141), and
 * CURRENT_USER_SOURCE, which is the implementation the guard chain in AppModule
 * binds to (D-25).
 *
 * It is @Global because `invitations` needs IdentityService too, and
 * `identity` already imports `invitations` (for the sign-up gate). A plain
 * import both ways is a module cycle; making this module global lets
 * `invitations` reach IdentityService without importing IdentityModule.
 */
@Global()
@Module({
  imports: [SettingsModule, InvitationsModule],
  controllers: [AuthController, ProfileController],
  providers: [
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: IDENTITY_PROVIDER, useClass: KeycloakIdentityProvider },
    { provide: CURRENT_USER_SOURCE, useClass: CookieCurrentUserSource },
    SignInWithProvider,
    ResolveCurrentUser,
    ReadMyProfile,
    ChangeMyProfile,
    DeleteMyAccount,
    IdentityService,
  ],
  exports: [IdentityService, CURRENT_USER_SOURCE],
})
export class IdentityModule {}
