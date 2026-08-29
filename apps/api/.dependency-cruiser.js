/**
 * The dependency rule and the module seams, checked by a tool, not by good
 * manners (R-143). A pull request that crosses a seam fails.
 *
 * Two rules, from R-141 and R-142:
 *   1. A module never imports another module's internals. It calls the other
 *      module's published service, which lives in <module>/<module>.service.ts.
 *   2. Inside a module, dependencies point inward only:
 *        http -> application -> domain
 *        infrastructure -> application -> domain
 *      domain imports no framework and no ORM.
 */
module.exports = {
  forbidden: [
    {
      name: 'no-cross-module-internals',
      severity: 'error',
      comment:
        'R-141: a module may only reach another module through its published service ' +
        '(<module>/<module>.service.ts) or its published contract (<module>/index.ts).',
      from: { path: '^src/modules/([^/]+)/' },
      to: {
        path: '^src/modules/([^/]+)/(.+)',
        pathNot: [
          // same module: anything goes
          '^src/modules/$1/',
          // other module: only its published surface — the service, the
          // barrel, or the Nest module itself, which is how composition works
          // and which exports nothing but that service.
          '^src/modules/[^/]+/(index|[^/]+\\.service|[^/]+\\.module)\\.ts$',
        ],
      },
    },
    {
      name: 'domain-imports-no-framework',
      severity: 'error',
      comment:
        'R-142: domain imports no framework and no ORM. A Prisma type never appears in domain.',
      from: { path: '^src/modules/[^/]+/domain/' },
      to: {
        path: 'node_modules',
        pathNot: '^node_modules/(zod|reflect-metadata)/',
      },
    },
    {
      name: 'domain-points-inward',
      severity: 'error',
      comment: 'R-142: domain may not import application, infrastructure or http.',
      from: { path: '^src/modules/[^/]+/domain/' },
      to: { path: '^src/modules/[^/]+/(application|infrastructure|http)/' },
    },
    {
      name: 'application-points-inward',
      severity: 'error',
      comment:
        'R-142/R-147: application defines the ports; infrastructure implements them. ' +
        'Application never imports infrastructure or http.',
      from: { path: '^src/modules/[^/]+/application/' },
      to: { path: '^src/modules/[^/]+/(infrastructure|http)/' },
    },
    {
      name: 'application-has-no-orm',
      severity: 'error',
      comment: 'R-147: use cases never see a Prisma client, so the ORM can be swapped.',
      from: { path: '^src/modules/[^/]+/application/' },
      to: { path: '^node_modules/(@prisma/client|prisma)/' },
    },
    {
      name: 'infrastructure-is-not-http',
      severity: 'error',
      comment: 'R-142: infrastructure never imports the HTTP layer.',
      from: { path: '^src/modules/[^/]+/infrastructure/' },
      to: { path: '^src/modules/[^/]+/http/' },
    },
    {
      name: 'shared-never-imports-a-module',
      severity: 'error',
      comment: 'The shared kernel is the base of the app. It cannot depend on a feature module.',
      from: { path: '^src/shared/' },
      to: { path: '^src/modules/' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'A cycle means the seam is not real.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      from: { orphan: true, pathNot: ['\\.d\\.ts$', '(^|/)(main|worker)\\.ts$'] },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(/tests/|\\.spec\\.ts$)' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['require', 'node'] },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
