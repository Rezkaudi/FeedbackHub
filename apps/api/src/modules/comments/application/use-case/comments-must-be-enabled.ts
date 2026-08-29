import { Injectable } from '@nestjs/common';
import { SettingsService } from '../../../settings/settings.service';
import { FeatureDisabledError } from '../../../../shared/errors/app-error';

/**
 * R-42, and hard part H-5: a feature switch that only hides a button is not a
 * feature switch. If the server still accepts the action, the switch does
 * nothing.
 *
 * So every comment action asks this first, and the answer is a refusal with a
 * clear message — not a 404, not a silent no-op. SRS part 17 names the test:
 * "given comments are off, when a browser sends a comment straight to the API,
 * then the server answers 403 with a message saying comments are switched off."
 */
@Injectable()
export class CommentsMustBeEnabled {
  public constructor(private readonly settings: SettingsService) {}

  public async check(): Promise<void> {
    if (!(await this.settings.commentsAreEnabled())) {
      throw new FeatureDisabledError('comments');
    }
  }
}
