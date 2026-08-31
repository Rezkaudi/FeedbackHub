import { TestBed } from '@angular/core/testing';
import { I18nStore } from './i18n.store';

describe('the i18n store', () => {
  function reload(): I18nStore {
    TestBed.resetTestingModule();
    return TestBed.inject(I18nStore);
  }

  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('lang');
    document.documentElement.removeAttribute('dir');
  });

  it('starts in English when nothing was ever chosen', () => {
    localStorage.clear();
    const store = reload();

    expect(store.language()).toBe('en');
    expect(store.direction()).toBe('ltr');
  });

  it('starts in Arabic when that is what this browser stored', () => {
    localStorage.clear();
    localStorage.setItem('fh.language', 'ar');
    const store = reload();

    expect(store.language()).toBe('ar');
    expect(store.direction()).toBe('rtl');
  });

  it('stamps <html lang and dir> from the current language', () => {
    localStorage.clear();
    const store = reload();

    store.setLanguage('ar');
    TestBed.flushEffects();

    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');

    store.setLanguage('en');
    TestBed.flushEffects();

    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('remembers the choice for the next load', () => {
    localStorage.clear();
    reload().setLanguage('ar');

    expect(reload().language()).toBe('ar');
  });

  it('translates a known key', () => {
    const store = reload();
    store.setLanguage('en');

    expect(store.translate('common.save')).toBe('Save');
  });

  it('interpolates parameters into a translation', () => {
    const store = reload();
    store.setLanguage('en');

    expect(store.translate('board.resultsFound', { count: 3 })).toBe('3 requests found');
  });

  it('falls back to the key itself when nothing matches', () => {
    const store = reload();

    // @ts-expect-error deliberately not a real key
    expect(store.translate('nothing.here')).toBe('nothing.here');
  });
});
