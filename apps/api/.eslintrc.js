/**
 * ESLint fails the build (R-155). Its job here is the one thing dependency-cruiser
 * cannot do well: ban `any` at every edge of the app (R-122, R-154).
 */
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'import'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'prettier',
  ],
  root: true,
  env: { node: true, jest: true },
  ignorePatterns: ['.eslintrc.js', 'jest.*.js', '.dependency-cruiser.js', 'dist', 'node_modules'],
  rules: {
    // R-122, R-154: no untyped holes.
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    '@typescript-eslint/no-unsafe-return': 'error',
    '@typescript-eslint/no-unsafe-argument': 'error',
    '@typescript-eslint/explicit-function-return-type': [
      'error',
      { allowExpressions: false, allowTypedFunctionExpressions: true },
    ],
    '@typescript-eslint/explicit-module-boundary-types': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/require-await': 'error',
    // `const { secret: _omitted, ...rest }` is the clearest way to build an
    // object *without* a field. Allow the underscore discard, ban everything else.
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
    ],

    // R-153: names say what a thing is, not what it is made of.
    'no-restricted-syntax': [
      'error',
      {
        selector:
          'ClassDeclaration[id.name=/(Util|Utils|Helper|Helpers|Manager|Data)$/]',
        message:
          'R-153: no utils, helpers, manager or data in a name. Say what the thing is.',
      },
    ],
  },
  overrides: [
    {
      // Tests may lean on Jest matchers that are typed loosely.
      files: ['**/tests/**/*.ts', '**/*.spec.ts'],
      rules: {
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
        // Supertest types Express's server as `any`; nothing here is our own
        // untyped edge, and the rule still applies to all production code.
        '@typescript-eslint/no-unsafe-argument': 'off',
        '@typescript-eslint/unbound-method': 'off',
      },
    },
  ],
};
