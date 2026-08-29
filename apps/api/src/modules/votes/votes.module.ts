import { Module } from '@nestjs/common';
import { VotesController } from './http/votes.controller';
import { VOTE_REPOSITORY } from './application/port/vote-repository';
import { PrismaVoteRepository } from './infrastructure/persistence/prisma-vote.repository';
import { CastVote } from './application/use-case/cast-vote';
import { WithdrawVote } from './application/use-case/withdraw-vote';
import { RequestsModule } from '../requests/requests.module';
import { SettingsModule } from '../settings/settings.module';

/** Owns the `votes` table. Nothing else touches it (R-141). */
@Module({
  imports: [RequestsModule, SettingsModule],
  controllers: [VotesController],
  providers: [
    { provide: VOTE_REPOSITORY, useClass: PrismaVoteRepository },
    CastVote,
    WithdrawVote,
  ],
})
export class VotesModule {}
