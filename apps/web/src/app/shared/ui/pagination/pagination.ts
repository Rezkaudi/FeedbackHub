import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconButton } from '../icon-button/icon-button';

@Component({
  selector: 'fh-pagination',
  imports: [IconButton],
  templateUrl: './pagination.html',
  styleUrl: './pagination.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Pagination {
  public readonly page = input.required<number>();
  public readonly pageCount = input.required<number>();
  public readonly previousLabel = input<string>('Previous');
  public readonly nextLabel = input<string>('Next');
  public readonly summary = input<string>('');
  public readonly testId = input<string | undefined>(undefined);
  public readonly pageChange = output<number>();

  protected readonly prevTestId = () => (this.testId() ? `${this.testId()}-prev` : undefined);
  protected readonly nextTestId = () => (this.testId() ? `${this.testId()}-next` : undefined);
  protected readonly summaryTestId = () => (this.testId() ? `${this.testId()}-summary` : null);
}
