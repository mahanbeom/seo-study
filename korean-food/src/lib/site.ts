/** SPEC.md §5 — URL 규칙을 한 곳에서만 정의한다. canonical·hreflang·sitemap이 어긋날 여지를 없앤다. */

export const LOCALES = ['en', 'ja', 'ko'] as const;
export type Locale = (typeof LOCALES)[number];

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
