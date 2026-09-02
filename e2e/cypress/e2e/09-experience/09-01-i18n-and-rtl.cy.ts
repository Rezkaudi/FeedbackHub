import { ADMIN } from '../../support/fixtures/accounts';
import { api } from '../../support/clients/api.client';
import { TID } from '../../support/utils/testids';

/** No selector or assertion here depends on English wording — only structure,
 *  attributes, and the absence of raw translation keys (a leaked key looks
 *  like `board.newRequest`, dotted lowercase segments). */
const RAW_KEY_PATTERN = /^[a-z][a-zA-Z]*(\.[a-zA-Z][a-zA-Z]*)+$/;

function assertNoRawKeys(): void {
  cy.get('body').should(($body) => {
    // innerText, not jQuery's .text(): .text() concatenates every descendant
    // text node with no separator at all, so two adjacent block-level
    // elements — e.g. a sentence ending "...instead." right next to a
    // "Save profile" button — collapse into one glued "instead.Save" word
    // that happens to match the raw-key shape. innerText respects layout
    // (block boundaries become whitespace), so it doesn't manufacture that.
    const text = ($body.get(0) as HTMLElement).innerText;
    const words = text.split(/\s+/).filter((w) => w.length > 3);
    const leaked = words.filter((w) => RAW_KEY_PATTERN.test(w));
    expect(leaked, `no raw translation keys should render: ${leaked.join(', ')}`).to.have.length(0);
  });
}

describe('i18n and RTL', () => {
  const PAGES = ['/', '/profile', '/admin/categories', '/admin/statuses', '/admin/settings', '/admin/invitations', '/admin/comments'];

  for (const page of PAGES) {
    it(`${page} renders with no leaked translation keys in English`, () => {
      cy.visitAs(ADMIN, page, { language: 'en' });
      cy.byTestId(TID.header.userMenuTrigger, { timeout: 10_000 }).should('be.visible');
      assertNoRawKeys();
    });

    it(`${page} renders in Arabic with dir="rtl" and no leaked keys`, () => {
      cy.visitAs(ADMIN, page, { language: 'ar' });
      cy.byTestId(TID.header.userMenuTrigger, { timeout: 10_000 }).should('be.visible');
      cy.get('html').should('have.attr', 'dir', 'rtl');
      assertNoRawKeys();
    });
  }

  it('switching language from the user menu takes effect immediately and persists server-side', () => {
    cy.visitAs(ADMIN, '/', { language: 'en' });
    cy.byTestId(TID.header.userMenuTrigger).click();
    cy.byTestId(`${TID.header.language}-ar`).click();
    cy.get('html').should('have.attr', 'dir', 'rtl');
    cy.window().its('localStorage').invoke('getItem', 'fh.language').should('eq', 'ar');
    cy.window().its('localStorage').then((storage: Storage) => storage.setItem('fh.language', 'en'));
  });

  it("the account form's language switch persists server-side, distinct from the header's local switch", () => {
    cy.visitAs(ADMIN, '/profile', { language: 'en' });
    cy.byTestId(`${TID.settings.accountLanguage}-ar`).click({ force: true });
    api.settings.me.read().its('language').should('eq', 'ar');
    api.settings.me.update({ language: null });
  });

  it('the theme segmented control switches theme and persists to localStorage', () => {
    cy.visitAs(ADMIN, '/', { theme: 'light' });
    cy.byTestId(TID.header.userMenuTrigger).click();
    cy.byTestId(`${TID.header.theme}-dark`).click();
    cy.get('html').should('have.attr', 'data-theme', 'dark');
    cy.window().its('localStorage').invoke('getItem', 'fh.theme').should('eq', 'dark');
  });
});
