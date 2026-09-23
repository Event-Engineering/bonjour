import path from 'path';
import js from '@eslint/js';
import globals from 'globals';
import stylistic from '@stylistic/eslint-plugin';
import tseslint from 'typescript-eslint';

// eslint-plugin-filename-rules uses context.getFilename() which was removed in ESLint 10.
// Inline a compatible replacement.
const filenamePlugin = {
	rules: {
		match: {
			meta: {
				type: 'layout',
				schema: [{}],
				messages: { noMatch: 'Filename \'{{name}}\' does not match {{value}}.' },
			},
			create(context) {
				return {
					Program(node) {
						const option = context.options[0];
						if (! option) {
							return;
						}
						const name = path.basename(context.filename);
						const pattern = option instanceof RegExp ? option : option.pattern;
						if (! pattern || pattern.test(name)) {
							return;
						}
						context.report({ node, messageId: 'noMatch', data: { name, value: pattern.toString() }});
					},
				};
			},
		},
	},
};

export default [
	{
		ignores: [ 'node_modules/**' ],
	},
	js.configs.recommended,
	stylistic.configs.customize({ indent: 'tab', quotes: 'single', semi: true, jsx: true }),
	...tseslint.configs.recommended.map(config => ({ ...config, files: [ '**/*.{ts,mts,cts,tsx}' ]})),
	{
		files: [ '**/*.{js,mjs,cjs,vue,ts,mts,cts,tsx}' ],
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'module',
			globals: {
				...globals.node,
				...globals.es2021,
			},
		},
		plugins: {
			'filename-rules': filenamePlugin,
		},
		rules: {
			curly: 'error',
			'no-empty': [ 'error', { allowEmptyCatch: true }],
			'no-fallthrough': 'off',
			'no-inner-declarations': 'off',
			'no-prototype-builtins': 'off',
			'no-unused-vars': [ 'warn', { vars: 'all', args: 'none', ignoreRestSiblings: false }],
			'@stylistic/array-bracket-newline': [ 'error', 'consistent' ],
			'@stylistic/array-bracket-spacing': [ 'error', 'always', { objectsInArrays: false, arraysInArrays: false }],
			'@stylistic/array-element-newline': [ 'error', { consistent: true }],
			'@stylistic/brace-style': [ 'error', '1tbs' ],
			'@stylistic/comma-dangle': [ 'error', { arrays: 'always-multiline', objects: 'always-multiline', imports: 'always-multiline', exports: 'always-multiline', functions: 'never' }],
			'@stylistic/curly-newline': [ 'error', { minElements: 1, multiline: true }],
			'@stylistic/function-call-argument-newline': [ 'warn', 'consistent' ],
			'@stylistic/indent': [ 'error', 'tab', { VariableDeclarator: 0, SwitchCase: 1, MemberExpression: 0, ignoredNodes: [ 'ConditionalExpression' ]}],
			'@stylistic/multiline-ternary': 'off',
			'@stylistic/object-curly-newline': [ 'error', { ObjectExpression: { consistent: true }, ObjectPattern: { consistent: true }, ImportDeclaration: 'never', ExportDeclaration: 'never' }],
			'@stylistic/object-curly-spacing': [ 'error', 'always', { objectsInObjects: false, arraysInObjects: false }],
			'@stylistic/object-property-newline': [ 'error', { allowAllPropertiesOnSameLine: true }],
			'@stylistic/quote-props': [ 'error', 'as-needed' ],
			'@stylistic/semi': 'error',
			'@stylistic/space-before-blocks': 'error',
			'@stylistic/space-before-function-paren': [ 'error', { anonymous: 'never', named: 'never', asyncArrow: 'never' }],
			'@stylistic/space-in-parens': [ 'error', 'never' ],
			'@stylistic/space-infix-ops': 'error',
			'@stylistic/space-unary-ops': [ 'error', { words: true, nonwords: true, overrides: { '++': false, '--': false, 'ts-non-null': true }}],
			'filename-rules/match': [ 2, { pattern: /^\.?([a-z]+-)*[a-z]+(?:\..*)?$/ }],
		},
	},
];
