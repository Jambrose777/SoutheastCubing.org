const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');
const eslintConfigPrettier = require('eslint-config-prettier');
const globals = require('globals');
const path = require('node:path');

const frontendRoot = path.join(__dirname, 'frontend');

module.exports = tseslint.config(
  {
    // Build output, caches, and local-only planning docs are never linted.
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.angular/**',
      '**/coverage/**',
      'frontend/out-tsc/**',
      '.github/**',
      'docs/**',
    ],
  },
  {
    files: ['frontend/src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: frontendRoot,
      },
    },
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      ...angular.configs.tsRecommended,
    ],
    // Lets Angular component `template: '...'` inline templates get linted as if
    // they were separate .html files.
    processor: angular.processInlineTemplates,
    rules: {
      // The established convention in this codebase is an "se-" prefix (e.g.
      // `se-home`, `se-map`) — enforce that instead of the stale "app" default
      // from angular.json.
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'se', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'se', style: 'kebab-case' },
      ],
      // These three rules push toward standalone components, inject(), and
      // OnPush change detection — each of those is a substantial, deliberate
      // migration of its own (already tracked as separate backlog work) rather
      // than something to fold into a formatting/linting setup story, so they're
      // switched off here for now instead of being mass-fixed.
      '@angular-eslint/prefer-standalone': 'off',
      '@angular-eslint/prefer-inject': 'off',
      '@angular-eslint/prefer-on-push-component-change-detection': 'off',
      // Reducing `any` usage across the frontend is its own dedicated cleanup
      // effort; leaving this off here avoids mixing that work into this story.
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['frontend/src/**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
    rules: {
      // A dedicated accessibility pass (alt text, keyboard handlers for
      // clickable elements, focusability) is already tracked as its own piece
      // of work, so these are left off here rather than patched over.
      '@angular-eslint/template/alt-text': 'off',
      '@angular-eslint/template/click-events-have-key-events': 'off',
      '@angular-eslint/template/interactive-supports-focus': 'off',
      '@angular-eslint/template/mouse-events-have-key-events': 'off',
    },
  },
  {
    files: ['backend/**/*.js', 'scripts/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
    extends: [js.configs.recommended],
  },
  // Applied last, across every file matched above, so Prettier stays the single
  // source of truth for formatting and ESLint never fights it over style rules.
  eslintConfigPrettier,
);
