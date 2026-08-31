import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Icon, type IconName } from '../icon/icon';

@Component({
  selector: 'fh-menu-item',
  imports: [RouterLink, NgTemplateOutlet, Icon],
  templateUrl: './menu-item.html',
  styleUrl: './menu-item.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuItem {
  public readonly icon = input<IconName | undefined>(undefined);
  public readonly routerLink = input<string | undefined>(undefined);
  public readonly disabled = input<boolean>(false);
  public readonly danger = input<boolean>(false);
  public readonly selected = input<boolean>(false);
}
