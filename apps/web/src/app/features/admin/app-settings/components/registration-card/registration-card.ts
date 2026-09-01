import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { TranslatePipe } from '../../../../../core/i18n/translate.pipe';
import { Button } from '../../../../../shared/ui/button/button';
import { Field } from '../../../../../shared/ui/field/field';
import { SectionCard } from '../../../../../shared/ui/section-card/section-card';
import type { AppSettings } from '../../../admin.store';

export type RegistrationPolicy = AppSettings['registrationPolicy'];

export interface RegistrationChange {
  registrationPolicy: RegistrationPolicy;
  allowedEmailDomains?: readonly string[];
}

/** Same shape the server enforces: labels of a-z/0-9/-, at least one dot. */
const DOMAIN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
const MAX_DOMAINS = 50;

/**
 * The policy picker saves the moment it changes, like the other cards. The one
 * exception is "domain restricted": that policy needs at least one domain in
 * the same save (R-67), so the domains field carries its own Save button and
 * the policy is held back until it is pressed.
 */
@Component({
  selector: 'fh-registration-card',
  imports: [TranslatePipe, Button, Field, SectionCard],
  templateUrl: './registration-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistrationCard {
  public readonly settings = input.required<AppSettings>();

  public readonly saved = output<RegistrationChange>();
  /** Fires when the person edits a field, so the shell can drop a stale banner. */
  public readonly touched = output<void>();

  /** What the picker shows. Re-seeds when the server sends a new row. */
  protected readonly pendingPolicy = linkedSignal(() => this.settings().registrationPolicy);
  protected readonly domains = linkedSignal(() => this.settings().allowedEmailDomains.join(', '));

  protected readonly policyHint = computed(() => {
    switch (this.pendingPolicy()) {
      case 'invite_only':
        return 'admin.registrationInviteOnlyDetail' as const;
      case 'domain_restricted':
        return 'admin.registrationDomainRestrictedDetail' as const;
      default:
        return 'admin.registrationOpenDetail' as const;
    }
  });

  protected readonly parsedDomains = computed(() =>
    this.domains()
      .split(',')
      .map((domain) => domain.trim().toLowerCase())
      .filter((domain) => domain.length > 0),
  );

  /** R-67: "domain restricted" with no domain would lock everyone out. */
  protected readonly needsDomain = computed(() => this.parsedDomains().length === 0);

  /** Entries that do not look like a domain — checked here so a bad one never
   * reaches the server and trips the generic "could not be saved" banner. */
  protected readonly badDomains = computed(() =>
    this.parsedDomains().filter((domain) => !DOMAIN.test(domain)),
  );

  protected readonly tooManyDomains = computed(() => this.parsedDomains().length > MAX_DOMAINS);

  /** The domain block has an unsaved edit: the switch to this policy, or the list. */
  protected readonly domainDirty = computed(() => {
    if (this.settings().registrationPolicy !== 'domain_restricted') {
      return true;
    }
    const next = this.parsedDomains();
    const saved = this.settings().allowedEmailDomains;
    return next.length !== saved.length || next.some((domain, i) => domain !== saved[i]);
  });

  protected readonly canSaveDomains = computed(
    () =>
      this.domainDirty() &&
      !this.needsDomain() &&
      this.badDomains().length === 0 &&
      !this.tooManyDomains(),
  );

  protected onPolicy(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (value !== 'open' && value !== 'invite_only' && value !== 'domain_restricted') {
      return;
    }
    this.pendingPolicy.set(value);
    this.touched.emit();
    // Every policy but this one saves right away; "domain restricted" waits for
    // its Save button so the domains go in the same call.
    if (value !== 'domain_restricted') {
      this.saved.emit({ registrationPolicy: value });
    }
  }

  protected onDomainsInput(event: Event): void {
    this.domains.set((event.target as HTMLInputElement).value);
    this.touched.emit();
  }

  protected onSaveDomains(): void {
    if (!this.canSaveDomains()) {
      return;
    }
    this.saved.emit({
      registrationPolicy: 'domain_restricted',
      allowedEmailDomains: this.parsedDomains(),
    });
  }
}
