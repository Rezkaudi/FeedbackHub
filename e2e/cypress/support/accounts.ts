export interface Account {
  username: string;
  password: string;
  displayName: string;
  isAdmin: boolean;
}

export const ADMIN: Account = {
  username: Cypress.env('ADMIN_USERNAME') ?? 'admin@feedbackhub.local',
  password: Cypress.env('ADMIN_PASSWORD') ?? 'password',
  displayName: 'Ada Admin',
  isAdmin: true,
};

export const SAM: Account = {
  username: Cypress.env('SAM_USERNAME') ?? 'sam@feedbackhub.local',
  password: Cypress.env('SAM_PASSWORD') ?? 'password',
  displayName: 'Sam Sample',
  isAdmin: false,
};

export const RAE: Account = {
  username: Cypress.env('RAE_USERNAME') ?? 'rae@feedbackhub.local',
  password: Cypress.env('RAE_PASSWORD') ?? 'password',
  displayName: 'Rae Reader',
  isAdmin: false,
};
