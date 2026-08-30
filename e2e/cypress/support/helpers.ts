export const IDS = {
  darkMode: '00000000-0000-4000-8000-0000000f0001',
  raeRequest: '00000000-0000-4000-8000-0000000f0002',
  spreadsheet: '00000000-0000-4000-8000-0000000f0003',
  retiredCategoryRequest: '00000000-0000-4000-8000-0000000f0004',
};

export const stamp = () => `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

export interface AppSettings {
  registrationPolicy: string;
  allowedEmailDomains: string[];
  submissionLimitCount: number;
  submissionLimitMinutes: number;
  voteLimitCount: number;
  voteLimitMinutes: number;
  signupLimitCount: number;
  signupLimitMinutes: number;
  commentsRequireApproval: boolean;
  featureCommentsEnabled: boolean;
}

export function readAppSettings(): Cypress.Chainable<AppSettings> {
  return cy.apiGet('/settings/app').then((response) => response.body as AppSettings);
}

export function writeAppSettings(changes: Partial<AppSettings>): Cypress.Chainable<void> {
  return cy.apiPatch('/settings/app', changes).then((response) => {
    expect(response.status, `settings PATCH failed: ${JSON.stringify(response.body)}`).to.eq(200);
  }) as unknown as Cypress.Chainable<void>;
}

export interface TaxonomyItem {
  id: string;
  name: string;
  slug: string;
  color: string;
  isActive: boolean;
}
export interface StatusItem extends TaxonomyItem {
  isDefault: boolean;
}

/** The categories and statuses come whole on the one bootstrap call (H-4). */
export function activeTaxonomy(): Cypress.Chainable<{
  categories: TaxonomyItem[];
  statuses: StatusItem[];
}> {
  return cy.apiGet('/bootstrap').then((response) => ({
    categories: response.body.categories as TaxonomyItem[],
    statuses: response.body.statuses as StatusItem[],
  }));
}
