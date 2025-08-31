import tseslint from '@typescript-eslint/eslint-plugin';
import parser from '@typescript-eslint/parser';

export default [
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: parser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      // Basic rules
      'no-unused-vars': 'off', // Turn off base rule
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'prefer-const': 'warn',
      'no-var': 'error',
      'eqeqeq': 'error',
      'curly': 'warn',
      
      // Code style
      'indent': ['warn', 4],
      'quotes': ['warn', 'double', { allowTemplateLiterals: true }],
      'semi': ['warn', 'always'],
      'comma-trailing': 'off', // Allow trailing commas
      'no-trailing-spaces': 'warn',
      'eol-last': 'warn',
    },
  },
  {
    files: ['bin/**/*.js', 'build/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      // More lenient rules for generated/build files
      'no-unused-vars': 'off',
    },
  },
  {
    ignores: [
      'node_modules/**',
      'build/**',
      'tests/**',
      'examples/**',
      '*.config.json',
    ],
  },
];