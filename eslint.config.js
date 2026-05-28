import path from 'path';
import js from '@eslint/js';
import globals from 'globals';

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
	{
		files: [ '**/*.{js,mjs,cjs,vue}' ],
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
			'curly': 'error',
			'no-empty': [ 'error', { allowEmptyCatch: true }],
			'no-fallthrough': 'off',
			'no-inner-declarations': 'off',
			'no-prototype-builtins': 'off',
			'no-unused-vars': [ 'warn', { vars: 'all', args: 'none', ignoreRestSiblings: false }],
			'filename-rules/match': [ 2, { pattern: /^\.?([a-z]+-)*[a-z]+(?:\..*)?$/ }],
		},
	},
];
