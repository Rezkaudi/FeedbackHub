import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nStore, type TranslationKey } from './i18n.store';

@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18nStore);

  public transform(key: TranslationKey, params?: Readonly<Record<string, string | number>>): string {
    return this.i18n.translate(key, params);
  }
}
