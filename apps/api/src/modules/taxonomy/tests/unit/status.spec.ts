import { Status } from '../../domain/entity/status';
import {
  DefaultStatusCannotBeRetiredError,
  RetiredStatusCannotBeDefaultError,
} from '../../domain/error/taxonomy-errors';
import { ValidationFailedError } from '../../../../shared/errors/app-error';

/**
 * The rules a single status keeps on its own, with no database and no clock
 * (R-152). Anything that needs to look at the other rows — "is this the last
 * one?" — is a use case, not an entity.
 */
const aStatus = (overrides: Partial<Parameters<typeof Status.rehydrate>[0]> = {}): Status =>
  Status.rehydrate({
    id: 'status-1',
    name: 'Under Review',
    slug: 'under-review',
    color: '#3366ff',
    isDefault: false,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  });

describe('Status', () => {
  describe('naming (R-44, SRS 12.5)', () => {
    it('refuses an empty name', () => {
      expect(() => aStatus().rename('   ')).toThrow(ValidationFailedError);
    });

    it('refuses a name longer than 40 letters', () => {
      expect(() => aStatus().rename('x'.repeat(41))).toThrow(ValidationFailedError);
    });

    it('trims the name, so " Done " and "Done" are not two different statuses', () => {
      const status = aStatus();

      status.rename('  Done  ');

      expect(status.name).toBe('Done');
    });
  });

  describe('colour (R-111)', () => {
    it('refuses anything that is not a hex colour, so the screen cannot be handed junk', () => {
      expect(() => aStatus().recolour('red')).toThrow(ValidationFailedError);
      expect(() => aStatus().recolour('#12')).toThrow(ValidationFailedError);
    });

    it('accepts a six-digit hex colour', () => {
      const status = aStatus();

      status.recolour('#AABBCC');

      expect(status.color).toBe('#aabbcc');
    });
  });

  describe('retiring (R-45, R-48)', () => {
    it('refuses to retire the status every new request starts in', () => {
      const first = aStatus({ isDefault: true });

      expect(() => first.retire()).toThrow(DefaultStatusCannotBeRetiredError);
      expect(first.isActive).toBe(true);
    });

    it('retires an ordinary status', () => {
      const status = aStatus();

      status.retire();

      expect(status.isActive).toBe(false);
    });

    it('is unbothered by retiring one that is already retired', () => {
      const status = aStatus({ isActive: false });

      expect(() => status.retire()).not.toThrow();
      expect(status.isActive).toBe(false);
    });
  });

  describe('becoming the first status (R-11, R-47)', () => {
    it('refuses to make a retired status the first one', () => {
      const retired = aStatus({ isActive: false });

      expect(() => retired.makeDefault()).toThrow(RetiredStatusCannotBeDefaultError);
    });

    it('marks an active status as the first one', () => {
      const status = aStatus();

      status.makeDefault();

      expect(status.isDefault).toBe(true);
    });
  });

  describe('creating one', () => {
    it('builds a slug from the name, so the web address is readable', () => {
      const status = Status.create({ name: 'In Progress', color: '#123456' }, 'status-9');

      expect(status.slug).toBe('in-progress');
      expect(status.isActive).toBe(true);
    });

    it('never starts out as the first status: that is a separate, deliberate act', () => {
      expect(Status.create({ name: 'Planned', color: '#123456' }, 'status-9').isDefault).toBe(false);
    });
  });
});
