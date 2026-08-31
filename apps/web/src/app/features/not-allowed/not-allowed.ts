import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

@Component({
  selector: 'fh-not-allowed',
  imports: [RouterLink, TranslatePipe],
  templateUrl: './not-allowed.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotAllowed {}
