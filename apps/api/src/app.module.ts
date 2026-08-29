import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { SharedModule } from './shared/shared.module';
import { TaxonomyModule } from './modules/taxonomy/taxonomy.module';
import { SettingsModule } from './modules/settings/settings.module';
import { IdentityModule } from './modules/identity/identity.module';
import { InvitationsModule } from './modules/invitations/invitations.module';
import { RequestsModule } from './modules/requests/requests.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { VotesModule } from './modules/votes/votes.module';
import { CommentsModule } from './modules/comments/comments.module';
import { BootstrapModule } from './modules/bootstrap/bootstrap.module';
import { AuthenticatedGuard } from './shared/http/authenticated.guard';
import { AdminGuard } from './shared/http/admin.guard';
import { OriginGuard } from './shared/http/origin.guard';

import { APP_ENVIRONMENT, type AppEnvironmentToken } from './shared/config/environment.token';

/**
 * The composition root. One deployable, cut into modules with hard seams
 * (R-140). Modules are added here as they are built; README.md says which of
 * them actually work.
 *
 * The guard chain is registered here, in the order of R-138, and in exactly one
 * place so no controller can rebuild it differently:
 *
 *   1. AuthenticatedGuard — is there a signed-in person?   (401)
 *   2. OriginGuard        — did this write come from us?   (403)
 *   3. AdminGuard         — does this route need admin?    (403)
 *
 * Links four and five of the chain — the permission check on the saved row and
 * the rate limit — are not guards. They need the row itself, so they live in the
 * use case that loads it, inside the same transaction as the write (R-132).
 *
 * It lives here rather than in the shared kernel because the first link needs an
 * implementation of CurrentUserSource, which belongs to the `identity` module,
 * and the shared kernel may never depend on a module (R-141). IdentityModule
 * exports that implementation; this module is where the two meet.
 */

@Module({
  imports: [
    SharedModule,
    TaxonomyModule,
    SettingsModule,
    InvitationsModule,
    IdentityModule,
    NotificationsModule,
    RequestsModule,
    VotesModule,
    CommentsModule,
    BootstrapModule,
  ],
  providers: [
    // The order below is the order they run in.
    { provide: APP_GUARD, useClass: AuthenticatedGuard },
    {
      provide: APP_GUARD,
      useFactory: (environment: AppEnvironmentToken): OriginGuard =>
        new OriginGuard(environment.auth.allowedOrigins),
      inject: [APP_ENVIRONMENT],
    },
    { provide: APP_GUARD, useClass: AdminGuard },
  ],
})
export class AppModule {}
