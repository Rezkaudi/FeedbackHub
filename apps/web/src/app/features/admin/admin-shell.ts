import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { BootstrapStore } from '../../core/bootstrap/bootstrap.store';
import { I18nStore, type TranslationKey } from '../../core/i18n/i18n.store';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Breadcrumbs } from '../../shared/ui/breadcrumbs/breadcrumbs';

const SECTION_LABEL: Record<string, TranslationKey> = {
  taxonomy: 'admin.taxonomy',
  settings: 'admin.appSettings',
  comments: 'admin.pendingComments',
  invitations: 'admin.invitations',
};

@Component({
  selector: 'fh-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe, Breadcrumbs],
  templateUrl: './admin-shell.html',
  styleUrl: './admin-shell.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminShell {
  protected readonly bootstrap = inject(BootstrapStore);
  private readonly i18n = inject(I18nStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly section = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => this.route.snapshot.firstChild?.routeConfig?.path ?? 'taxonomy'),
    ),
    { initialValue: 'taxonomy' },
  );

  protected readonly crumbs = computed(() => [
    { label: this.i18n.translate('nav.requests'), link: '/' },
    { label: this.i18n.translate('nav.admin'), link: '/admin' },
    { label: this.i18n.translate(SECTION_LABEL[this.section()] ?? 'admin.taxonomy') },
  ]);
}
