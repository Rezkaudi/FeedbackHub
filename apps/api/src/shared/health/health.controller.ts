import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { Public } from '../http/route-metadata';
import { ServiceUnavailableException } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { APP_ENVIRONMENT, type AppEnvironmentToken } from '../config/environment.token';

/**
 * R-83: two health checks, and they must tell the truth.
 *
 *   live  — is the process up? Nothing else. A failing dependency must not
 *           restart a healthy process, so this never touches the database.
 *   ready — may it receive traffic? Only if the database, Redis and the
 *           identity provider can all be reached.
 *
 * Both are public (R-6): a probe has no session.
 */
@ApiTags('health')
@Controller()
export class HealthController {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @Inject(APP_ENVIRONMENT) private readonly environment: AppEnvironmentToken,
  ) {}

  @Public()
  @Get('health/live')
  @ApiOperation({ summary: 'Is the process alive? Checks nothing else.' })
  @ApiOkResponse({ description: 'The process is running.' })
  public live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Public()
  @Get('health/ready')
  @ApiOperation({ summary: 'May this instance receive traffic?' })
  @ApiOkResponse({ description: 'Every dependency answered.' })
  @ApiServiceUnavailableResponse({ description: 'At least one dependency did not answer.' })
  public async ready(): Promise<{
    status: 'ok';
    checks: Record<string, 'up' | 'down'>;
  }> {
    const [database, redis, identityProvider] = await Promise.all([
      this.canReachDatabase(),
      this.redis.isReachable(),
      this.canReachIdentityProvider(),
    ]);

    const checks: Record<string, 'up' | 'down'> = {
      database: database ? 'up' : 'down',
      redis: redis ? 'up' : 'down',
      identityProvider: identityProvider ? 'up' : 'down',
    };

    if (Object.values(checks).includes('down')) {
      // A readiness probe that lies is worse than no probe at all.
      throw new ServiceUnavailableException({ status: 'unavailable', checks });
    }

    return { status: 'ok', checks };
  }

  private async canReachDatabase(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  private async canReachIdentityProvider(): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.environment.oidc.issuerUrl}/.well-known/openid-configuration`,
        { signal: AbortSignal.timeout(2000) },
      );
      return response.ok;
    } catch {
      return false;
    }
  }
}
