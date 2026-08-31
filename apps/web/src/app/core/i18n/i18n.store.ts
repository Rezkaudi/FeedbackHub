import { DOCUMENT, Injectable, computed, effect, inject, signal, type Signal } from '@angular/core';
import { DevicePreferencesStore } from '../config/device-preferences.store';
import { en } from './translations/en';
import { ar } from './translations/ar';
import type { Leaves, SameShape } from './translation-key';

export type Language = 'en' | 'ar';
export type Direction = 'ltr' | 'rtl';
export type TranslationKey = Leaves<typeof en>;

const DICTIONARIES: Record<Language, SameShape<typeof en>> = { en, ar };
const LANGUAGES: readonly Language[] = ['en', 'ar'];

function valueAt(dictionary: unknown, path: readonly string[]): string | undefined {
  let node: unknown = dictionary;
  for (const segment of path) {
    if (typeof node !== 'object' || node === null) {
      return undefined;
    }
    node = (node as Record<string, unknown>)[segment];
  }
  return typeof node === 'string' ? node : undefined;
}

function interpolate(template: string, params: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

@Injectable({ providedIn: 'root' })
export class I18nStore {
  private readonly document = inject(DOCUMENT);
  private readonly preferences = inject(DevicePreferencesStore);

  private readonly current = signal<Language>(this.initialLanguage());

  public readonly language: Signal<Language> = this.current.asReadonly();
  public readonly direction: Signal<Direction> = computed(() =>
    this.current() === 'ar' ? 'rtl' : 'ltr',
  );

  public constructor() {
    effect(() => {
      const language = this.current();
      const root = this.document.documentElement;
      root.lang = language;
      root.dir = language === 'ar' ? 'rtl' : 'ltr';
    });
  }

  public setLanguage(language: Language): void {
    if (!LANGUAGES.includes(language)) {
      return;
    }
    this.current.set(language);
    this.preferences.setStoredLanguage(language);
  }

  public translate(key: TranslationKey, params?: Readonly<Record<string, string | number>>): string {
    const dictionary = DICTIONARIES[this.current()];
    const template = valueAt(dictionary, key.split('.')) ?? valueAt(en, key.split('.')) ?? key;
    return params === undefined ? template : interpolate(template, params);
  }

  private initialLanguage(): Language {
    const stored = this.preferences.storedLanguage();
    return stored === 'ar' ? 'ar' : 'en';
  }
}
