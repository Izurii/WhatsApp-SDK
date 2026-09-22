import js from '@eslint/js';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import jest from 'eslint-plugin-jest';
import prettier from 'eslint-config-prettier';

export default [
	{
		ignores: [
			'**/node_modules/**',
			'**/build/**',
			'**/coverage/**',
			'**/.docusaurus/**',
			'**/.yarn/**',
		],
	},
	js.configs.recommended,
	{
		languageOptions: {
			globals: { ...globals.node, ...globals.browser },
			parserOptions: { ecmaFeatures: { jsx: true } },
		},
		rules: { 'no-console': 'warn' },
	},
	{
		files: ['**/*.ts'],
		languageOptions: { parser: tsParser },
		plugins: { '@typescript-eslint': tsPlugin },
		rules: {
			...tsPlugin.configs['eslint-recommended'].overrides[0].rules,
			...tsPlugin.configs.recommended.rules,
			'@typescript-eslint/no-explicit-any': 'off',
		},
	},
	{
		files: ['src/__tests__/**/*.ts'],
		languageOptions: { globals: jest.environments.globals.globals },
		plugins: { jest },
		rules: {
			...jest.configs.recommended.rules,
			'jest/no-standalone-expect': [
				'error',
				{
					additionalTestBlockFunctions: ['beforeEach', 'afterEach'],
				},
			],
		},
	},
	prettier,
];
