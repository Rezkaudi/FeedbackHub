import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RequestCard } from '../request-card/request-card';
import type { RequestRow } from '../../board.store';
import type { VotePatch } from '../../../../core/requests/vote.service';

@Component({
  selector: 'fh-request-grid',
  imports: [RequestCard],
  templateUrl: './request-grid.html',
  styleUrl: './request-grid.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestGrid {
  public readonly items = input.required<readonly RequestRow[]>();
  public readonly voted = output<{ id: string; patch: VotePatch }>();
  public readonly deleted = output<string>();
}
