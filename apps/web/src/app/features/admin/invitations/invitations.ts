import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AdminStore, type Invitation } from '../admin.store';
import { I18nStore } from '../../../core/i18n/i18n.store';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ApiErrorPipe } from '../../../core/error/api-error.pipe';
import { ConfirmService } from '../../../shared/ui/dialog/confirm.service';
import { ErrorPanel } from '../../../shared/ui/state/error-panel/error-panel';
import { SkeletonCard } from '../../../shared/ui/state/skeleton-card/skeleton-card';
import { EmptyPanel } from '../../../shared/ui/state/empty-panel/empty-panel';
import { SectionCard } from '../../../shared/ui/section-card/section-card';
import { InviteForm } from './components/invite-form/invite-form';
import { InvitationTable } from './components/invitation-table/invitation-table';

@Component({
  selector: 'fh-invitations',
  imports: [
    TranslatePipe,
    ApiErrorPipe,
    ErrorPanel,
    SkeletonCard,
    EmptyPanel,
    SectionCard,
    InviteForm,
    InvitationTable,
  ],
  templateUrl: './invitations.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Invitations {
  protected readonly admin = inject(AdminStore);
  private readonly confirm = inject(ConfirmService);
  private readonly i18n = inject(I18nStore);

  public constructor() {
    void this.admin.loadInvitations().then(() => this.admin.loadSettings(true));
  }

  /** R-67: an invitation dead-ends at sign-in while this policy is on. */
  protected domainRestricted(): boolean {
    return this.admin.settings()?.registrationPolicy === 'domain_restricted';
  }

  protected invite(email: string): void {
    void this.admin.invite(email);
  }

  protected async withdraw(invitation: Invitation): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: this.i18n.translate('admin.withdrawConfirmTitle'),
      message: this.i18n.translate('admin.withdrawConfirmMessage'),
      confirmLabel: this.i18n.translate('admin.withdraw'),
      tone: 'danger',
    });
    if (confirmed) {
      void this.admin.withdrawInvitation(invitation.id);
    }
  }
}
