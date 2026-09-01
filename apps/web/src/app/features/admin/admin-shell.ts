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
import { Icon, type IconName } from '../../shared/ui/icon/icon';

interface AdminSection {
  readonly path: string;
  readonly label: TranslationKey;
  readonly icon: IconName;
}

const SECTIONS: readonly AdminSection[] = [
  { path: 'categories', label: 'admin.categories', icon: 'grid' },
  { path: 'statuses', label: 'admin.statuses', icon: 'check-circle' },
  { path: 'settings', label: 'admin.appSettings', icon: 'filter' },
  { path: 'comments', label: 'admin.pendingComments', icon: 'message-circle' },
  { path: 'invitations', label: 'admin.invitations', icon: 'mail' },
];

@Component({
  selector: 'fh-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe, Breadcrumbs, Icon],
  templateUrl: './admin-shell.html',
  styleUrl: './admin-shell.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminShell {
  protected readonly bootstrap = inject(BootstrapStore);
  private readonly i18n = inject(I18nStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly sections = computed<readonly AdminSection[]>(() =>
    SECTIONS.filter(
      (section) => section.path !== 'comments' || this.bootstrap.commentsRequireApproval(),
    ),
  );

  private readonly section = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => this.route.snapshot.firstChild?.routeConfig?.path ?? 'categories'),
    ),
    { initialValue: 'categories' },
  );

  protected readonly crumbs = computed(() => {
    const current = SECTIONS.find((section) => section.path === this.section());
    return [
      { label: this.i18n.translate('nav.requests'), link: '/' },
      { label: this.i18n.translate('nav.admin'), link: '/admin' },
      { label: this.i18n.translate(current?.label ?? 'admin.categories') },
    ];
  });
}
