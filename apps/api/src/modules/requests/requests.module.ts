import { Module } from '@nestjs/common';
import { RequestsController } from './http/requests.controller';
import { RequestsService } from './requests.service';
import { REQUEST_REPOSITORY } from './application/port/request-repository';
import { PrismaRequestRepository } from './infrastructure/persistence/prisma-request.repository';
import { ReadBoard } from './application/use-case/read-board';
import { ReadRequest } from './application/use-case/read-request';
import { SubmitRequest } from './application/use-case/submit-request';
import { EditRequest } from './application/use-case/edit-request';
import { DeleteRequest } from './application/use-case/delete-request';
import { ChangeRequestStatus } from './application/use-case/change-request-status';
import { PinRequest } from './application/use-case/pin-request';
import { TaxonomyModule } from '../taxonomy/taxonomy.module';
import { SettingsModule } from '../settings/settings.module';
import { NotificationsModule } from '../notifications/notifications.module';

/** Owns `feedback_requests`. Nothing else touches it (R-141). */
@Module({
  imports: [TaxonomyModule, SettingsModule, NotificationsModule],
  controllers: [RequestsController],
  providers: [
    { provide: REQUEST_REPOSITORY, useClass: PrismaRequestRepository },
    ReadBoard,
    ReadRequest,
    SubmitRequest,
    EditRequest,
    DeleteRequest,
    ChangeRequestStatus,
    PinRequest,
    RequestsService,
  ],
  exports: [RequestsService],
})
export class RequestsModule {}
