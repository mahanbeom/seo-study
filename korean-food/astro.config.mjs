// @ts-check
import { readdirSync, readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { parse as parseYaml } from 'yaml';

// SPEC.md §4.1 — 전 페이지를 빌드 타임에 프리렌더한다.
// AI 크롤러(GPTBot/ClaudeBot/PerplexityBot)는 JS를 실행하지 않으므로
// 초기 HTML 완결성이 이 프로젝트의 전제 조건이다.
// output: 'server' 로 바꾸거나 prerender = false 를 붙이지 말 것.

const SITE = 'https://mahanbeom.github.io';
const BASE = '/seo-study/korean-food';

/**
 * 로케일 URL → 최종 수정일.
 *
 * 사이트맵의 `lastmod` 는 **실제 수정일**이어야 한다. 매 빌드마다 현재 시각을 넣는
 * 식으로 거짓 값을 주면 크롤러가 이 신호를 신뢰하지 않게 되고, 정말로 고쳤을 때
 * 재크롤이 늦어진다. 그래서 콘텐츠의 dateModified 를 그대로 읽는다.
 *
 * astro.config 에서는 `astro:content` 를 쓸 수 없어 YAML 을 직접 읽는다.
 */
const CONTENT_DIR = new URL('./src/content/pages/', import.meta.url);

const lastmodByUrl = new Map(
  readdirSync(CONTENT_DIR)
    .filter((name) => name.endsWith('.yaml'))
    .map((name) => {
      const data = parseYaml(readFileSync(new URL(name, CONTENT_DIR), 'utf8'));
      return [`${SITE}${BASE}/${data.locale}/`, new Date(data.dateModified).toISOString()];
    }),
);

export default defineConfig({
  site: SITE,
  // SPEC.md §4.3 — 실험 하나 = 폴더 하나 = URL 경로 하나.
  // 저장소 루트를 점유하지 않아야 두 번째 실험을 나란히 붙일 수 있다.
  base: BASE,
  output: 'static',
  // SPEC.md §5 — 후행 슬래시 정책을 하나로 고정한다. canonical/hreflang도 전부 이 형태.
  trailingSlash: 'always',
  build: { format: 'directory' },
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'ja', 'ko'],
    // 기본 언어에도 접두어를 붙여 /en/ 을 명시적으로 노출한다.
    // 접두어 없는 중복 URL이 생기지 않아 canonical 관리가 단순해진다.
    routing: { prefixDefaultLocale: true },
  },
  integrations: [
    sitemap({
      // 루트(`/seo-study/korean-food/`)는 noindex 언어 선택 페이지다.
      // 사이트맵에 넣으면 Search Console 이 "제출된 URL이 noindex로 표시됨" 으로
      // 경고하고, 로케일 접두어가 없어 기본 로케일로 오인되어 hreflang 이 중복된다.
      filter: (page) => page !== `${SITE}${BASE}/`,
      serialize(item) {
        const lastmod = lastmodByUrl.get(item.url);
        if (lastmod) item.lastmod = lastmod;
        return item;
      },
      // xhtml:link hreflang 대체 링크를 사이트맵에 함께 기재한다.
      i18n: {
        defaultLocale: 'en',
        locales: { en: 'en-US', ja: 'ja-JP', ko: 'ko-KR' },
      },
    }),
  ],
});
