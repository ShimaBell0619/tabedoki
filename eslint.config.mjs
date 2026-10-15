import parser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';

export default [{
  files: ['src/**/*.{ts,tsx}'],
  languageOptions: { parser, parserOptions: { ecmaFeatures: { jsx: true } } },
  plugins: { 'react-hooks': reactHooks },
  rules: {
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'error',
  },
}, {
  files: ['src/domain/**/*.ts'],
  rules: {
    'no-restricted-imports': ['error', { patterns: [
      'react', 'react/*', '@supabase/*', '../data/*', '../features/*', '../app/*', '../components/*',
      '@/data/*', '@/features/*', '@/app/*', '@/components/*',
    ] }],
  },
}, {
  files: ['src/data/**/*.ts'],
  rules: {
    'no-restricted-imports': ['error', { patterns: [
      'react', 'react/*', '../app/*', '../features/*', '../components/*',
      '@/app/*', '@/features/*', '@/components/*',
    ] }],
  },
}, {
  files: ['src/features/**/*.{ts,tsx}'],
  rules: {
    'no-restricted-imports': ['error', { patterns: ['../../app/*', '../../data/*', '@/app/*', '@/data/*'] }],
  },
}, {
  files: ['src/components/**/*.{ts,tsx}'],
  rules: {
    'no-restricted-imports': ['error', { patterns: [
      '../app/*', '../features/*', '../domain/*', '../data/*',
      '../../app/*', '../../features/*', '../../domain/*', '../../data/*',
      '@/app/*', '@/features/*', '@/domain/*', '@/data/*',
    ] }],
  },
}];
