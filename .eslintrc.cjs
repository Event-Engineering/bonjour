module.exports = {
	env: {
		amd: true,
		browser: true,
		es2021: true,
		node: true,
	},
	globals: {
	},
	extends: [
		'eslint:recommended',
	],
	parserOptions: {
		ecmaVersion: 'latest',
		sourceType: 'module',
	},
	rules: {
		curly: 'error',
		'comma-dangle': ['error', {arrays: 'always-multiline', objects: 'always-multiline', imports: 'always-multiline', exports: 'always-multiline', functions: 'never'}],
		semi: 'error',
		indent: ['error', 'tab', {VariableDeclarator: 0, SwitchCase: 1, MemberExpression: 0}],
		'no-unused-vars': ['warn', {vars: 'all', args: 'none', ignoreRestSiblings: false }],
		'no-fallthrough': 'off',
		'no-inner-declarations': 'off',
		'no-prototype-builtins': 'off',
		'no-empty': ['error', { allowEmptyCatch: true }],
		'function-call-argument-newline': ['error', 'consistent'],
	},
};
