/** Mailpit REST client. Both the API worker (comment/status/invitation mail)
 *  and Keycloak (verify-email, reset-password) send here. Assertions are
 *  scoped to the recipient — `to:<address>` — never a blanket purge, so specs
 *  stay safe under parallelism. */

export interface MailSummary {
  ID: string;
  Subject: string;
  To: { Address: string }[];
  Created: string;
}

export interface MailMessage extends MailSummary {
  Text: string;
  HTML: string;
  From: { Address: string };
}

function mpOrigin(): string {
  return String(Cypress.env('mailpitOrigin') ?? 'http://localhost:8025');
}

export const mailpit = {
  purgeAll(): Cypress.Chainable<void> {
    return cy
      .request({ method: 'DELETE', url: `${mpOrigin()}/api/v1/messages`, body: {} })
      .then(() => cy.wrap<void>(undefined, { log: false }));
  },

  purgeFor(address: string): Cypress.Chainable<void> {
    return cy
      .request({
        method: 'DELETE',
        url: `${mpOrigin()}/api/v1/search?query=${encodeURIComponent(`to:${address}`)}`,
      })
      .then(() => cy.wrap<void>(undefined, { log: false }));
  },

  search(query: string): Cypress.Chainable<MailSummary[]> {
    return cy
      .request(`${mpOrigin()}/api/v1/search?query=${encodeURIComponent(query)}`)
      .then((response) => (response.body as { messages: MailSummary[] }).messages ?? []);
  },

  /** Polls `search()` until at least `min` messages match or the timeout
   *  blows. Mail is produced asynchronously by the worker off a Redis queue —
   *  never replace this with a fixed `cy.wait(ms)`. */
  waitFor(
    query: string,
    opts: { min?: number; timeout?: number; interval?: number } = {},
  ): Cypress.Chainable<MailSummary[]> {
    const min = opts.min ?? 1;
    const timeout = opts.timeout ?? 15_000;
    const interval = opts.interval ?? 500;
    const deadline = Date.now() + timeout;

    const attempt = (): Cypress.Chainable<MailSummary[]> =>
      mailpit.search(query).then((messages) => {
        if (messages.length >= min) {
          return cy.wrap(messages, { log: false });
        }
        if (Date.now() > deadline) {
          throw new Error(`mailpit: never saw ${min} message(s) matching "${query}" within ${timeout}ms`);
        }
        return cy.wait(interval, { log: false }).then(attempt);
      });

    return attempt();
  },

  /** Asserts NO message matches after a settle window — for opt-out and
   *  reject cases, where the absence of mail is the thing under test. */
  expectNone(query: string, settleMs = 3_000): Cypress.Chainable<void> {
    return cy.wait(settleMs, { log: false }).then(() =>
      mailpit.search(query).then((messages) => {
        expect(messages, `no mail should match "${query}"`).to.have.length(0);
        return cy.wrap<void>(undefined, { log: false });
      }),
    );
  },

  read(id: string): Cypress.Chainable<MailMessage> {
    return cy.request(`${mpOrigin()}/api/v1/message/${id}`).its('body');
  },

  latestFor(address: string): Cypress.Chainable<MailMessage> {
    return mailpit.waitFor(`to:${address}`).then((messages) => {
      const first = messages[0];
      if (!first) {
        throw new Error(`mailpit: no message found for "${address}"`);
      }
      return mailpit.read(first.ID);
    });
  },

  /** First http(s) URL found in the plaintext body, falling back to the first
   *  `href` in the HTML body — Keycloak mail is multipart. */
  firstLink(message: MailMessage): string {
    const textMatch = /https?:\/\/[^\s<>"']+/.exec(message.Text ?? '');
    if (textMatch) {
      return textMatch[0];
    }
    const htmlMatch = /href="([^"]+)"/.exec(message.HTML ?? '');
    if (htmlMatch?.[1]) {
      return htmlMatch[1].replace(/&amp;/g, '&');
    }
    throw new Error(`mailpit: no link found in message ${message.ID}`);
  },

  linkFor(address: string, opts: { subjectContains?: string } = {}): Cypress.Chainable<string> {
    const query = opts.subjectContains ? `to:${address} subject:"${opts.subjectContains}"` : `to:${address}`;
    return mailpit
      .waitFor(query)
      .then((messages) => {
        const first = messages[0];
        if (!first) {
          throw new Error(`mailpit: no message found matching "${query}"`);
        }
        return mailpit.read(first.ID);
      })
      .then((message) => mailpit.firstLink(message));
  },
};
