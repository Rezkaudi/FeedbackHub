import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { RequestFormDialog } from './request-form-dialog';

@Component({
  selector: 'fh-request-form-page',
  imports: [RequestFormDialog],
  templateUrl: './request-form-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestFormPage {
  private readonly router = inject(Router);

  public readonly id = input<string | undefined>(undefined);

  protected close(): void {
    void this.router.navigate(this.id() === undefined ? ['/'] : ['/requests', this.id()]);
  }

  protected onSaved(id: string): void {
    void this.router.navigate(['/requests', id]);
  }
}
