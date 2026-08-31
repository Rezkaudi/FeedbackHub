import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { UserMenu } from '../user-menu/user-menu';

@Component({
  selector: 'fh-app-header',
  imports: [RouterLink, RouterLinkActive, TranslatePipe, UserMenu],
  templateUrl: './app-header.html',
  styleUrl: './app-header.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppHeader {}
