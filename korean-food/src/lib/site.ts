/** SPEC.md §5 — URL 규칙을 한 곳에서만 정의한다. canonical·hreflang·sitemap이 어긋날 여지를 없앤다. */

export const LOCALES = ['en', 'ja', 'ko'] as const;
export type Locale = (typeof LOCALES)[number];

/**
 * Google Search Console 소유권 확인 토큰.
 *
 * 속성은 URL 접두어 방식이다 — `github.io` 는 GitHub 소유라 DNS 를 건드릴 수 없어
 * 도메인 속성을 쓸 수 없다. 확인 대상 URL 은 속성 루트인
 * `https://mahanbeom.github.io/seo-study/korean-food/` 이다.
 *
 * 이 태그를 지우면 소유권 확인이 조용히 풀린다.
 * scripts/verify-seo.mjs 가 존재 여부를 검사한다.
 */
export const GOOGLE_SITE_VERIFICATION = 'CAZX55gflxBSRi64hqqe7G32u-iJlTuufrn9E_8y_jE';

/** 언어가 매칭되지 않는 사용자에게 줄 버전 (SPEC §4.6). */
export const X_DEFAULT_LOCALE: Locale = 'en';

export const OG_LOCALE: Record<Locale, string> = {
  en: 'en_US',
  ja: 'ja_JP',
  ko: 'ko_KR',
};

export const LOCALE_LABEL: Record<Locale, string> = {
  en: 'English',
  ja: '日本語',
  ko: '한국어',
};

/** 항상 후행 슬래시로 끝나는 base 경로. */
function basePath(): string {
  const raw = import.meta.env.BASE_URL || '/';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

/**
 * 소셜 카드 이미지. 1200x630 고정.
 *
 * src/assets 가 아니라 public/ 에 둔다 — og:image 는 빌드마다 해시가 바뀌지 않는
 * **안정적인 절대 URL** 이어야 캐시된 카드가 깨지지 않는다.
 */
export const OG_IMAGE = { path: 'og/korean-food.jpg', width: 1200, height: 630 };

/** og:image 및 JSON-LD Article.image 에 쓸 절대 URL. */
export function ogImageUrl(site: URL | undefined): string {
  if (!site) throw new Error('astro.config.mjs 의 `site` 가 필요합니다.');
  return new URL(asset(OG_IMAGE.path), site).href;
}

/** public/ 자산의 경로. base 접두어를 붙인다 — Astro 는 임의 속성 문자열에 base 를 붙여주지 않는다. */
export function asset(path: string): string {
  return `${basePath()}${path.replace(/^\//, '')}`;
}

/** `/seo-study/korean-food/en/` — 사이트 내부 링크용 상대 경로. */
export function localePath(locale: Locale): string {
  return `${basePath()}${locale}/`;
}

/** `https://…/seo-study/korean-food/en/` — canonical·hreflang·JSON-LD @id 용 절대 URL. */
export function localeUrl(site: URL | undefined, locale: Locale): string {
  if (!site) throw new Error('astro.config.mjs 의 `site` 가 필요합니다 (절대 canonical 생성).');
  return new URL(localePath(locale), site).href;
}

/** 사이트 루트(언어 선택 페이지)의 절대 URL. */
export function rootUrl(site: URL | undefined): string {
  if (!site) throw new Error('astro.config.mjs 의 `site` 가 필요합니다.');
  return new URL(basePath(), site).href;
}
