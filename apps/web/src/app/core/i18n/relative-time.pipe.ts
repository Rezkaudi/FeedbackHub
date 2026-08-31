import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nStore } from './i18n.store';

const LOCALE: Record<string, string> = { en: 'en-US', ar: 'ar-EG' };

const UNITS: ReadonlyArray<readonly [Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 60 * 60 * 24 * 365],
  ['month', 60 * 60 * 24 * 30],
  ['week', 60 * 60 * 24 * 7],
  ['day', 60 * 60 * 24],
  ['hour', 60 * 60],
  ['minute', 60],
];

@Pipe({ name: 'relativeTime', pure: false })
export class RelativeTimePipe implements PipeTransform {
  private readonly i18n = inject(I18nStore);

  public transform(value: string | Date | null | undefined): string {
    if (value === null || value === undefined) {
      return '';
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const locale = LOCALE[this.i18n.language()] ?? 'en-US';
    const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    const seconds = (date.getTime() - Date.now()) / 1000;
    const absolute = Math.abs(seconds);

    for (const [unit, unitSeconds] of UNITS) {
      if (absolute >= unitSeconds) {
        return formatter.format(Math.round(seconds / unitSeconds), unit);
      }
    }

    return formatter.format(Math.round(seconds), 'second');
  }
}
