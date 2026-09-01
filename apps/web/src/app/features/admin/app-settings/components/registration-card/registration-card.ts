import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { TranslatePipe } from '../../../../../core/i18n/translate.pipe';
import { Field } from '../../../../../shared/ui/field/field';
import { SectionCard } from '../../../../../shared/ui/section-card/section-card';
import type { AppSettings } from '../../../admin.store';

export type RegistrationPolicy = AppSettings['registrationPolicy'];

@Component({
  selector: 'fh-registration-card',
  imports: [TranslatePipe, Field, SectionCard],
  templateUrl: './registration-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistrationCard {
  public readonly settings = input.required<AppSettings>();

  public readonly policyChanged = output<RegistrationPolicy>();
  public readonly domainsChanged = output<readonly string[]>();

  protected readonly domains = linkedSignal(() => this.settings().allowedEmailDomains.join(', '));

  protected readonly policyHint = computed(() => {
    switch (this.settings().registrationPolicy) {
      case 'invite_only':
        return 'admin.registrationInviteOnlyDetail' as const;
      case 'domain_restricted':
        return 'admin.registrationDomainRestrictedDetail' as const;
      default:
        return 'admin.registrationOpenDetail' as const;
    }
  });

  protected onPolicy(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (value === 'open' || value === 'invite_only' || value === 'domain_restricted') {
      this.policyChanged.emit(value);
    }
  }

  protected onDomainsInput(event: Event): void {
    this.domains.set((event.target as HTMLInputElement).value);
  }

  protected onDomainsBlur(): void {
    this.domainsChanged.emit(
      this.domains()
        .split(',')
        .map((domain) => domain.trim().toLowerCase())
        .filter((domain) => domain.length > 0),
    );
  }
}
