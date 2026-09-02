type KeyedBy = Partial<Record<'request' | 'comment' | 'category' | 'status' | 'invitation' | 'taxonomy', string>>;
type GetOptions = Partial<Cypress.Loggable & Cypress.Timeoutable & Cypress.Withinable>;

declare global {
  namespace Cypress {
    interface Chainable {
      /** `[data-testid="<id>"]`. */
      byTestId(id: string, options?: GetOptions): Chainable<JQuery>;
      /** `[data-testid="<id>"]`, scoped by a keyed data attribute — e.g.
       *  `cy.byTestIdFor('request-card', { request: id })` also requires
       *  `[data-request-id="<id>"]`, so a spec addresses exactly the row it
       *  created without depending on order, paging, or translated text. */
      byTestIdFor(id: string, keyed: KeyedBy, options?: GetOptions): Chainable<JQuery>;
      /** Visits `url` with the given persona already signed in (via
       *  `cy.signIn`) and the locale/theme forced, so no spec inherits
       *  another's language or theme. */
      visitAs(
        account: import('../fixtures/accounts').Account,
        url?: string,
        opts?: { language?: 'en' | 'ar'; theme?: 'system' | 'light' | 'dark' },
      ): Chainable<void>;
      /** Seeds `localStorage['fh.language']` before the next visit, without
       *  requiring a sign-in — for the sign-in-problem / pre-auth specs. */
      setLocale(language: 'en' | 'ar'): Chainable<void>;
    }
  }
}

function selector(id: string, keyed?: KeyedBy): string {
  let sel = `[data-testid="${id}"]`;
  if (keyed) {
    for (const [key, value] of Object.entries(keyed)) {
      if (value !== undefined) {
        sel += `[data-${key}-id="${value}"]`;
      }
    }
  }
  return sel;
}

Cypress.Commands.add('byTestId', (id, options) => cy.get(selector(id), options));
Cypress.Commands.add('byTestIdFor', (id, keyed, options) => cy.get(selector(id, keyed), options));

Cypress.Commands.add('setLocale', (language: 'en' | 'ar') => {
  cy.window({ log: false }).then((win) => {
    win.localStorage.setItem('fh.language', language);
  });
});

Cypress.Commands.add(
  'visitAs',
  (account, url = '/', opts: { language?: 'en' | 'ar'; theme?: 'system' | 'light' | 'dark' } = {}) => {
    cy.signIn(account);
    cy.visit(url, {
      onBeforeLoad(win) {
        win.localStorage.setItem('fh.language', opts.language ?? 'en');
        win.localStorage.setItem('fh.theme', opts.theme ?? 'light');
      },
    });
  },
);

export {};
