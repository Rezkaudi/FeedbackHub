import { DOCUMENT, Injectable, effect, inject } from '@angular/core';
import { DevicePreferencesStore } from './device-preferences.store';

/**
 * Puts the chosen theme on the root element, where tokens.css is watching for
 * it (R-55, R-56).
 *
 * The *first* application is not done here — it is done by the inline script in
 * index.html, before the first paint, because anything Angular does happens
 * after the browser has already painted and the person would see white flash to
 * dark. This class owns every application after that one: the toggle, and the
 * live change when the machine's own setting flips while the app is open.
 */
@Injectable({ providedIn: 'root' })
export class ThemeApplier {
  private readonly preferences = inject(DevicePreferencesStore);
  private readonly document = inject(DOCUMENT);

  public constructor() {
    effect(() => {
      const theme = this.preferences.theme();
      const root = this.document.documentElement;

      // "Follow the computer" means *no* attribute: the media query in
      // tokens.css then decides, and it keeps deciding as the machine changes,
      // with no listener of ours to keep in sync (R-55).
      if (theme === 'system') {
        root.removeAttribute('data-theme');
      } else {
        root.setAttribute('data-theme', theme);
      }
    });
  }
}
