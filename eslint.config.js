import eslintPluginVue from 'eslint-plugin-vue'
import globals from 'globals'

/** 미사용 코드 정리용 — 스타일 규칙은 제외 */
export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  ...eslintPluginVue.configs['flat/essential'],
  {
    files: ['**/*.vue', '**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      'vue/multi-word-component-names': 'off',
      'no-unused-vars': [
        'warn',
        {
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'vue/no-unused-vars': 'warn',
      'vue/no-unused-components': 'warn',
    },
  },
]
