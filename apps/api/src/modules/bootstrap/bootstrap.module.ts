import { Module } from '@nestjs/common';
import { BootstrapController } from './http/bootstrap.controller';
import { ReadBootstrap } from './application/use-case/read-bootstrap';
import { IdentityModule } from '../identity/identity.module';
import { SettingsModule } from '../settings/settings.module';
import { TaxonomyModule } from '../taxonomy/taxonomy.module';

/**
 * The ninth module. R-140 names eight; this one exists because R-52 needs a
 * single call composing data owned by three of them, and putting it inside any
 * one would break R-141.
 *
 * It owns no table and holds no rule — only the composition. See SCOPE.md §8.
 */
@Module({
  imports: [IdentityModule, SettingsModule, TaxonomyModule],
  controllers: [BootstrapController],
  providers: [ReadBootstrap],
})
export class BootstrapModule {}
