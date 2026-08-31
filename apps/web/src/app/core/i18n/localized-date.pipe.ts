import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nStore } from './i18n.store';

const LOCALE: Record<string, string> = { en: 'en-US', ar: 'ar-EG' };

@Pipe({ name: 'localizedDate', pure: false })
export class LocalizedDatePipe implements PipeTransform {
  private readonly i18n = inject(I18nStore);

  public transform(
    value: string | Date | null | undefined,
    options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
  ): string {
    if (value === null || value === undefined) {
      return '';
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const locale = LOCALE[this.i18n.language()] ?? 'en-US';
    return new Intl.DateTimeFormat(locale, options).format(date);
  }
}
