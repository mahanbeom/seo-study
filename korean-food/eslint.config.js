import config from '@mahanbeom/kit/eslint';

export default [
  ...config,
  {
    // 프로젝트 고유 예외 — 이 파일들은 브라우저가 아니라 Node(빌드 머신)에서 실행된다.
    // 공통 규칙을 건드리지 않고 여기에만 Node 전역을 준다.
    files: ['scripts/**/*.mjs', 'astro.config.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        URL: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        Buffer: 'readonly',
      },
    },
  },
  {
    // .astro 컴포넌트는 eslint-plugin-astro 없이는 파싱할 수 없다.
    // 타입·문법 검증은 `npm run typecheck` (astro check) 가 담당한다.
    ignores: ['dist/**', '.astro/**'],
  },
];
