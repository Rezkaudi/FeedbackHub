import { resolveBoardQuery, toQueryParams, type Taxonomy } from './board-query';

/**
 * R-22: the search, filters, sort and page live in the web address, so a board
 * view can be copied, shared and found again with the back button.
 *
 * R-24: on the first visit the board uses the person's saved sort and filters —
 * but if the web address says something else, the web address wins. That
 * precedence is the whole of this file, and it is easy to get backwards: a
 * shared link that silently reverted to the recipient's own saved filters would
 * show them a different board from the one that was sent.
 */
describe('what board the address asks for', () => {
  const saved = {
    sort: 'most_votes' as const,
    statusIds: ['s-saved'],
    categoryIds: ['c-saved'],
    mine: false,
  };

  const taxonomy: Taxonomy = {
    statusIds: ['s1', 's2', 's-saved'],
    categoryIds: ['c1', 'c2', 'c-saved'],
  };

  describe('when the address says nothing', () => {
    it('uses what this person saved', () => {
      const query = resolveBoardQuery(new URLSearchParams(), { ...saved, mine: true }, taxonomy);

      expect(query.sort).toBe('most_votes');
      expect(query.statusIds).toEqual(['s-saved']);
      expect(query.categoryIds).toEqual(['c-saved']);
      expect(query.mine).toBe(true);
    });

    it('starts on the first page, searching for nothing', () => {
      const query = resolveBoardQuery(new URLSearchParams(), saved, taxonomy);

      expect(query.page).toBe(1);
      expect(query.search).toBe('');
    });
  });

  describe('when the address says something', () => {
    it('wins over what this person saved (R-24)', () => {
      const query = resolveBoardQuery(new URLSearchParams('sort=oldest'), saved, taxonomy);

      expect(query.sort).toBe('oldest');
    });

    /**
     * The case that matters most: a link shared with filters cleared. Falling
     * back to the recipient's saved filters here would show them a different
     * board from the one they were sent, and there would be no way to send an
     * unfiltered one.
     */
    it('treats an explicitly empty filter as a choice, not as absence', () => {
      const query = resolveBoardQuery(new URLSearchParams('filtered=1'), saved, taxonomy);

      expect(query.statusIds).toEqual([]);
      expect(query.categoryIds).toEqual([]);
    });

    it('turns the saved "my requests" default off when the address carries filters', () => {
      const query = resolveBoardQuery(
        new URLSearchParams('filtered=1'),
        { ...saved, mine: true },
        taxonomy,
      );

      expect(query.mine).toBe(false);
    });

    it('reads "my requests" back from the address', () => {
      const query = resolveBoardQuery(new URLSearchParams('filtered=1&mine=1'), saved, taxonomy);

      expect(query.mine).toBe(true);
    });

    it('reads more than one value for the same filter (R-18)', () => {
      const query = resolveBoardQuery(
        new URLSearchParams('filtered=1&statusIds=s1&statusIds=s2'),
        saved,
        taxonomy,
      );

      expect(query.statusIds).toEqual(['s1', 's2']);
    });

    it('reads the search words and the page', () => {
      const query = resolveBoardQuery(
        new URLSearchParams('search=dark+mode&page=3'),
        saved,
        taxonomy,
      );

      expect(query.search).toBe('dark mode');
      expect(query.page).toBe(3);
    });
  });

  /**
   * Anything in the address was typed by a person or came from an old link.
   * None of it may reach the server as-is (R-20, R-97) and none of it may break
   * the board.
   */
  describe('an address that cannot be trusted', () => {
    it('falls back to the saved sort when the address asks for one that does not exist', () => {
      const query = resolveBoardQuery(new URLSearchParams('sort=best'), saved, taxonomy);

      expect(query.sort).toBe('most_votes');
    });

    it('falls back to page one for a page that is not a number', () => {
      expect(resolveBoardQuery(new URLSearchParams('page=abc'), saved, taxonomy).page).toBe(1);
      expect(resolveBoardQuery(new URLSearchParams('page=0'), saved, taxonomy).page).toBe(1);
      expect(resolveBoardQuery(new URLSearchParams('page=-4'), saved, taxonomy).page).toBe(1);
    });

    /**
     * SRS 15.1: a category retired while somebody was filtering by it must keep
     * working. Sending an id the server has never heard of would answer nothing
     * and look like an empty board.
     */
    it('drops filter ids that no longer exist, and keeps the rest', () => {
      const query = resolveBoardQuery(
        new URLSearchParams('filtered=1&categoryIds=c1&categoryIds=deleted'),
        saved,
        taxonomy,
      );

      expect(query.categoryIds).toEqual(['c1']);
    });

    it('drops a saved filter whose category has since been retired', () => {
      const query = resolveBoardQuery(new URLSearchParams(), saved, {
        statusIds: ['s1'],
        categoryIds: ['c1'],
      });

      expect(query.categoryIds).toEqual([]);
      expect(query.statusIds).toEqual([]);
    });

    it('trims search words so a page of spaces is not a search', () => {
      expect(resolveBoardQuery(new URLSearchParams('search=%20%20'), saved, taxonomy).search).toBe(
        '',
      );
    });
  });

  /**
   * The address is written back after every change, and it has to stay
   * readable: a board with no filters should have a clean URL, not a trail of
   * empty parameters.
   */
  describe('writing the address back', () => {
    it('leaves out everything that is at its default', () => {
      const params = toQueryParams({
        search: '',
        statusIds: [],
        categoryIds: [],
        mine: false,
        sort: 'newest',
        page: 1,
      });

      expect(params).toEqual({ filtered: '1' });
    });

    it('writes only what differs from the default', () => {
      const params = toQueryParams({
        search: 'dark',
        statusIds: ['s1'],
        categoryIds: [],
        mine: true,
        sort: 'most_votes',
        page: 2,
      });

      expect(params).toEqual({
        filtered: '1',
        search: 'dark',
        statusIds: ['s1'],
        mine: '1',
        sort: 'most_votes',
        page: 2,
      });
    });

    it('round-trips, so a shared link opens the board it was copied from', () => {
      const original = {
        search: 'dark mode',
        statusIds: ['s1', 's2'],
        categoryIds: ['c1'],
        mine: true,
        sort: 'most_comments' as const,
        page: 4,
      };

      const params = toQueryParams(original);
      const search = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        for (const one of Array.isArray(value) ? value : [value]) {
          search.append(key, String(one));
        }
      }

      expect(resolveBoardQuery(search, saved, taxonomy)).toEqual(original);
    });
  });
});
