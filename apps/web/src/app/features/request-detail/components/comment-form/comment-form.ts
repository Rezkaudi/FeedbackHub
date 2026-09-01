import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { ApiErrorPipe } from '../../../../core/error/api-error.pipe';
import type { ApiError } from '../../../../core/error/api-error';
import { Button } from '../../../../shared/ui/button/button';

@Component({
  selector: 'fh-comment-form',
  imports: [TranslatePipe, ApiErrorPipe, Button],
  templateUrl: './comment-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommentForm {
  public readonly draft = input.required<string>();
  public readonly saving = input<boolean>(false);
  public readonly error = input<ApiError | null>(null);

  public readonly draftChange = output<string>();
  public readonly submitted = output<void>();

  protected onInput(event: Event): void {
    this.draftChange.emit((event.target as HTMLTextAreaElement).value);
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    this.submitted.emit();
  }
}
