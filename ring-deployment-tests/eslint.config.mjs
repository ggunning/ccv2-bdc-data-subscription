import config from '@bdc-fos/eslint-config';
export default [
    ...config,
    {
        ignores: [
            // Ignore output directory for the type package
            "bin/",
            "docs/",
            "coverage/",
            "types-package/",
            "local-debug/"
        ]
    },
    {
        rules: {
            '@typescript-eslint/consistent-type-assertions': 'off',
            '@typescript-eslint/consistent-type-imports': 'off',
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/no-confusing-void-expression': 'off',
            '@typescript-eslint/switch-exhaustiveness-check': 'off',
            '@typescript-eslint/unbound-method': 'off',
            'complexity': 'off',
            'max-lines': 'off',
            'no-new-wrappers': 'off',
            'no-return-assign': 'off'
        }
    }
];
