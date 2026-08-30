import { TestBed } from '@angular/core/testing';
import { DevicePreferencesStore } from './device-preferences.store';

/**
 * R-51: a setting is resolved as code default, then the person's own, and the
 * last one filled in wins. R-58 and D-06 put theme, default sort and default
 * filters in the browser rather than on the server, on purpose: they belong to
 * this device, and should not follow a person onto a shared machine or into a
 * private window.
 *
 * SRS part 17 asks for three of these by name:
 *   - dark on my laptop, code default on my phone
 *   - clear the browser data, everything returns to the code default
 *   - a saved filter pointing at a retired category is skipped, nothing breaks
 */
describe('the preferences that live in this browser', () => {
  /** A fresh browser, with whatever was already in storage before this load. */
  function storeWith(stored: Record<string, string>): DevicePreferencesStore {
    localStorage.clear();
    for (const [key, value] of Object.entries(stored)) {
      localStorage.setItem(key, value);
    }
    return reload();
  }

  /**
   * The next page load: a new store, reading storage as it now stands. Distinct
   * from storeWith on purpose — a reload does not wipe what the last one wrote,
   * and conflating the two is how "it is remembered" ends up untested.
   */
  function reload(): DevicePreferencesStore {
    TestBed.resetTestingModule();
    return TestBed.inject(DevicePreferencesStore);
  }

  afterEach(() => localStorage.clear());

  describe('the code defaults', () => {
    it('follows the computer for theme when nothing was ever chosen', () => {
      expect(storeWith({}).theme()).toBe('system');
    });

    it('sorts by newest, and filters by nothing', () => {
      const store = storeWith({});

      expect(store.defaultSort()).toBe('newest');
      expect(store.defaultStatusIds()).toEqual([]);
      expect(store.defaultCategoryIds()).toEqual([]);
    });

    it('returns to the code default when the browser data is cleared', () => {
      const store = storeWith({ 'fh.theme': 'dark' });
      expect(store.theme()).toBe('dark');

      expect(storeWith({}).theme()).toBe('system');
    });
  });

  describe('what the person chose', () => {
    it('wins over the code default', () => {
      expect(storeWith({ 'fh.theme': 'dark' }).theme()).toBe('dark');
    });

    it('is remembered for the next load', () => {
      const store = storeWith({});

      store.setTheme('dark');

      expect(localStorage.getItem('fh.theme')).toBe('dark');
      expect(reload().theme()).toBe('dark');
    });

    it('keeps a chosen sort and the two filters', () => {
      const store = storeWith({});

      store.setDefaultSort('most_votes');
      store.setDefaultStatusIds(['s1', 's2']);
      store.setDefaultCategoryIds(['c1']);

      const reloaded = reload();
      expect(reloaded.defaultSort()).toBe('most_votes');
      expect(reloaded.defaultStatusIds()).toEqual(['s1', 's2']);
      expect(reloaded.defaultCategoryIds()).toEqual(['c1']);
    });
  });

  /**
   * The values in storage came from an older version of the app, or from
   * somebody typing in the console. Neither may break the board.
   */
  describe('a value that cannot be trusted', () => {
    it('ignores a theme that is not one of the three', () => {
      expect(storeWith({ 'fh.theme': 'neon' }).theme()).toBe('system');
    });

    it('ignores a sort the server would refuse (R-20)', () => {
      expect(storeWith({ 'fh.defaultSort': 'best' }).defaultSort()).toBe('newest');
    });

    it('ignores filters that are not a list of strings', () => {
      expect(storeWith({ 'fh.defaultStatusIds': '{"not":"a list"}' }).defaultStatusIds()).toEqual(
        [],
      );
      expect(storeWith({ 'fh.defaultCategoryIds': 'not json at all' }).defaultCategoryIds()).toEqual(
        [],
      );
    });

    /** SRS 15.6: a saved default filter pointing at a retired category is
     * skipped, and nothing breaks. */
    it('drops filter ids that no longer exist, and keeps the rest', () => {
      const store = storeWith({ 'fh.defaultCategoryIds': '["gone","c1"]' });

      expect(store.knownCategoryIds(['c1', 'c2'])).toEqual(['c1']);
    });

    it('drops every filter id when they have all gone, rather than failing', () => {
      const store = storeWith({ 'fh.defaultCategoryIds': '["gone","also-gone"]' });

      expect(store.knownCategoryIds(['c1'])).toEqual([]);
    });
  });

  /**
   * A private window can throw on any localStorage access, not just return
   * null. If that takes down the store, it takes down the whole app, because
   * the shell reads the theme before it renders anything.
   */
  describe('when the browser refuses to store anything', () => {
    it('still gives the code defaults instead of throwing', () => {
      const broken = () => {
        throw new Error('access denied');
      };
      const original = Object.getOwnPropertyDescriptor(Storage.prototype, 'getItem');
      Storage.prototype.getItem = broken as never;

      try {
        TestBed.resetTestingModule();
        const store = TestBed.inject(DevicePreferencesStore);

        expect(store.theme()).toBe('system');
        expect(store.defaultSort()).toBe('newest');
      } finally {
        if (original) Object.defineProperty(Storage.prototype, 'getItem', original);
      }
    });

    it('does not throw when a write is refused either', () => {
      const original = Object.getOwnPropertyDescriptor(Storage.prototype, 'setItem');
      Storage.prototype.setItem = (() => {
        throw new Error('quota exceeded');
      }) as never;

      try {
        TestBed.resetTestingModule();
        const store = TestBed.inject(DevicePreferencesStore);

        expect(() => store.setTheme('dark')).not.toThrow();
        // The choice still applies to this session, it just will not survive.
        expect(store.theme()).toBe('dark');
      } finally {
        if (original) Object.defineProperty(Storage.prototype, 'setItem', original);
      }
    });
  });
});
