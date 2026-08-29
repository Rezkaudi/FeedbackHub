// `prisma migrate` reads .env by itself, but the Prisma *client* does not — so
// running this script by hand failed with "Environment variable not found:
// DATABASE_URL" while the migration right before it had just worked. In the
// container DATABASE_URL is already set and this changes nothing.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

/**
 * R-120: the example data can be loaded again and again without breaking, and it
 * is rich enough to see every case in SRS part 15 — including the empty ones.
 *
 * Everything is an upsert keyed on a stable natural key, so running it twice
 * changes nothing. That matters because the one-command start (R-80) runs it on
 * every boot.
 *
 * `externalId` below is the **Keycloak user id**, pinned in
 * infra/keycloak/realm/feedbackhub-realm.json. That is what keeps the two in
 * step: without it, signing in as the seeded admin would make a *new* record as
 * an ordinary user, because R-4 matches people by external id and Keycloak
 * would have invented its own (D-26).
 */
const prisma = new PrismaClient();

const CATEGORIES = [
  { name: 'Bug', slug: 'bug', color: '#c62828', description: 'Something is broken.' },
  { name: 'Feature', slug: 'feature', color: '#1565c0', description: 'Something new.' },
  { name: 'Improvement', slug: 'improvement', color: '#2e7d32', description: 'Make something better.' },
  { name: 'Question', slug: 'question', color: '#6a1b9a', description: 'Ask about something.' },
  // Retired on purpose, so the "still shown correctly on old requests" case of
  // R-45 can be seen without editing anything.
  { name: 'Legacy', slug: 'legacy', color: '#616161', description: 'No longer offered.', isActive: false },
];

/** In pipeline order, because both lists are read in created_at order (R-49, D-14). */
const STATUSES = [
  { name: 'New', slug: 'new', color: '#616161', isDefault: true },
  { name: 'Under Review', slug: 'under-review', color: '#1565c0' },
  { name: 'Planned', slug: 'planned', color: '#00838f' },
  { name: 'In Progress', slug: 'in-progress', color: '#ef6c00' },
  { name: 'Done', slug: 'done', color: '#2e7d32' },
  { name: 'Declined', slug: 'declined', color: '#c62828' },
];

const PEOPLE = [
  {
    id: '00000000-0000-4000-8000-00000000ad01',
    externalId: '11111111-1111-4111-8111-111111111111',
    email: 'admin@feedbackhub.local',
    displayName: 'Ada Admin',
    role: 'admin' as const,
  },
  {
    id: '00000000-0000-4000-8000-000000000001',
    externalId: '22222222-2222-4222-8222-222222222222',
    email: 'sam@feedbackhub.local',
    displayName: 'Sam Sample',
    role: 'user' as const,
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    externalId: '33333333-3333-4333-8333-333333333333',
    email: 'rae@feedbackhub.local',
    displayName: 'Rae Reader',
    role: 'user' as const,
  },
];

async function main(): Promise<void> {
  // R-42 and R-130 defaults, as one row that always exists.
  await prisma.appSettings.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  });

  for (const category of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      create: category,
      update: { color: category.color, description: category.description },
    });
  }

  for (const status of STATUSES) {
    await prisma.status.upsert({
      where: { slug: status.slug },
      create: status,
      update: { color: status.color },
    });
  }

  for (const person of PEOPLE) {
    await prisma.user.upsert({
      where: { externalId: person.externalId },
      create: { ...person, emailVerified: true },
      // The role is refreshed so a demo database always has its admin back.
      update: { role: person.role, displayName: person.displayName },
    });
  }

  const [admin, sam, rae] = PEOPLE;
  const bug = await prisma.category.findUniqueOrThrow({ where: { slug: 'bug' } });
  const feature = await prisma.category.findUniqueOrThrow({ where: { slug: 'feature' } });
  const legacy = await prisma.category.findUniqueOrThrow({ where: { slug: 'legacy' } });
  const newStatus = await prisma.status.findUniqueOrThrow({ where: { slug: 'new' } });
  const planned = await prisma.status.findUniqueOrThrow({ where: { slug: 'planned' } });
  const done = await prisma.status.findUniqueOrThrow({ where: { slug: 'done' } });

  const requests = [
    {
      id: '00000000-0000-4000-8000-0000000f0001',
      title: 'Dark mode for the whole board',
      description:
        'Reading the board in a dark room is hard on the eyes. A dark theme that follows the ' +
        'computer setting would help the whole team.',
      categoryId: feature.id,
      statusId: planned.id,
      authorId: sam?.id ?? '',
      isPinned: true,
      pinnedAt: new Date(),
    },
    {
      id: '00000000-0000-4000-8000-0000000f0002',
      title: 'Search does not find words in the description',
      description:
        'Searching for a word that only appears in the description of a request returns nothing. ' +
        'It should look at both the title and the description.',
      categoryId: bug.id,
      statusId: newStatus.id,
      authorId: rae?.id ?? '',
    },
    {
      id: '00000000-0000-4000-8000-0000000f0003',
      title: 'Export the board to a spreadsheet',
      description:
        'For the quarterly review it would help to pull the whole board into a spreadsheet, with ' +
        'the votes and the statuses.',
      categoryId: feature.id,
      statusId: done.id,
      authorId: sam?.id ?? '',
    },
    {
      // Uses a retired category, so R-45 is visible on the board.
      id: '00000000-0000-4000-8000-0000000f0004',
      title: 'An older request on a retired category',
      description:
        'This one was filed under a category that has since been retired. It must still show ' +
        'that category correctly even though nobody can pick it any more.',
      categoryId: legacy.id,
      statusId: newStatus.id,
      authorId: rae?.id ?? '',
    },
  ];

  for (const request of requests) {
    await prisma.feedbackRequest.upsert({
      where: { id: request.id },
      create: request,
      update: { title: request.title, description: request.description },
    });
  }

  // Votes: enough to make the "most votes" sort show something, and none on the
  // last request so the zero-votes case is visible.
  const votes = [
    { requestId: requests[0]?.id ?? '', userId: admin?.id ?? '' },
    { requestId: requests[0]?.id ?? '', userId: rae?.id ?? '' },
    { requestId: requests[0]?.id ?? '', userId: sam?.id ?? '' },
    { requestId: requests[1]?.id ?? '', userId: sam?.id ?? '' },
  ];

  for (const vote of votes) {
    await prisma.vote.upsert({
      where: { requestId_userId: { requestId: vote.requestId, userId: vote.userId } },
      create: vote,
      update: {},
    });
  }

  const comments = [
    {
      id: '00000000-0000-4000-8000-0000000c0001',
      requestId: requests[0]?.id ?? '',
      authorId: admin?.id ?? '',
      body: 'Good idea. We are planning this for the next quarter.',
      state: 'published' as const,
    },
    {
      id: '00000000-0000-4000-8000-0000000c0002',
      requestId: requests[0]?.id ?? '',
      authorId: rae?.id ?? '',
      body: 'Please make it follow the computer setting rather than a switch.',
      state: 'published' as const,
    },
    {
      // A deleted comment, so the grey line of R-38 is visible in the thread.
      id: '00000000-0000-4000-8000-0000000c0003',
      requestId: requests[0]?.id ?? '',
      authorId: sam?.id ?? '',
      body: '',
      state: 'deleted' as const,
      deletedAt: new Date(),
    },
  ];

  for (const comment of comments) {
    await prisma.comment.upsert({
      where: { id: comment.id },
      create: comment,
      update: { body: comment.body, state: comment.state },
    });
  }

  // Request 2 has no comments at all, so the "No comments yet" empty state of
  // SRS 15.2 can be seen without deleting anything.

  await prisma.invitation.upsert({
    where: { email: 'invited@feedbackhub.local' },
    create: { email: 'invited@feedbackhub.local' },
    update: {},
  });

  console.log('Seed data loaded.');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
