import { BootstrapResponse } from '../../http/dto/bootstrap.dto';
import { BootstrapData } from '../../application/use-case/read-bootstrap';

/**
 * R-45 says a retired category is gone from the picker but still shown
 * correctly on the old requests that use it. A screen can only keep that promise
 * if it is told about the retired rows: a request carries a categoryId, and a
 * name it cannot look up is a blank chip.
 *
 * So the one start-up call (R-52) carries every category and status, each
 * marked active or not, and the screen filters the pickers itself. Sending only
 * the active ones would make R-45 impossible without a second call, and a chain
 * of calls is the bug H-4 exists to prevent.
 */
describe('the one start-up call', () => {
  const data: BootstrapData = {
    user: {
      id: 'u1',
      displayName: 'Sam',
      avatarUrl: null,
      role: 'user',
      email: 'sam@feedbackhub.local',
    },
    settings: { language: 'en', notifyOnComment: true, notifyOnStatusChange: false },
    appSettings: { featureCommentsEnabled: true, commentsRequireApproval: false },
    categories: [
      { id: 'c1', name: 'Bug', slug: 'bug', color: '#DC2626', isActive: true },
      { id: 'c2', name: 'Legacy', slug: 'legacy', color: '#78716C', isActive: false },
    ],
    statuses: [
      { id: 's1', name: 'New', slug: 'new', color: '#0369A1', isActive: true, isDefault: true },
      { id: 's2', name: 'Parked', slug: 'parked', color: '#78716C', isActive: false, isDefault: false },
    ],
  } as unknown as BootstrapData;

  it('carries retired categories too, so an old request can still be labelled', () => {
    const response = BootstrapResponse.from(data);

    expect(response.categories.map((category) => category.name)).toEqual(['Bug', 'Legacy']);
  });

  it('says which ones are retired, so the picker can leave them out', () => {
    const response = BootstrapResponse.from(data);

    expect(response.categories.find((category) => category.name === 'Legacy')?.isActive).toBe(false);
    expect(response.statuses.find((status) => status.name === 'Parked')?.isActive).toBe(false);
    expect(response.statuses.find((status) => status.name === 'New')?.isActive).toBe(true);
  });

  it('still sends no admin setting and no email address', () => {
    const serialised = JSON.stringify(BootstrapResponse.from(data));

    expect(serialised).not.toContain('sam@feedbackhub.local');
    expect(serialised).not.toContain('signupLimit');
    expect(serialised).not.toContain('registrationPolicy');
  });
});
