/** Fixed ids from `apps/api/prisma/seed/seed.ts` — read-mostly reference data.
 *  Specs may read them and may vote on them (reversible); anything needing an
 *  edit, delete, pin or status change creates its own request instead. */
export const SEED = {
  requests: {
    /** "Dark mode for the whole board" — feature/planned, Sam, pinned, 3 votes,
     *  2 published comments + 1 deleted comment. */
    darkMode: '00000000-0000-4000-8000-0000000f0001',
    /** "Search does not find words in the description" — bug/new, Rae, 1 vote,
     *  no comments. */
    searchBug: '00000000-0000-4000-8000-0000000f0002',
    /** "Export the board to a spreadsheet" — feature/done, Sam, 0 votes. */
    spreadsheet: '00000000-0000-4000-8000-0000000f0003',
    /** "An older request on a retired category" — legacy(retired)/new, Rae. */
    retiredCategoryRequest: '00000000-0000-4000-8000-0000000f0004',
  },
  comments: {
    published1: '00000000-0000-4000-8000-0000000c0001',
    published2: '00000000-0000-4000-8000-0000000c0002',
    deleted: '00000000-0000-4000-8000-0000000c0003',
  },
  users: {
    admin: '00000000-0000-4000-8000-00000000ad01',
    admin2: '00000000-0000-4000-8000-00000000ad02',
    sam: '00000000-0000-4000-8000-000000000001',
    rae: '00000000-0000-4000-8000-000000000002',
  },
  categories: ['bug', 'feature', 'improvement', 'question', 'legacy'] as const,
  statuses: ['new', 'under-review', 'planned', 'in-progress', 'done', 'declined'] as const,
  defaultStatusSlug: 'new',
  retiredCategorySlug: 'legacy',
  invitedAddress: 'invited@feedbackhub.local',
} as const;
