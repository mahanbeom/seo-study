import { getCollection } from 'astro:content';
import { LOCALES, X_DEFAULT_LOCALE, type Locale } from './site';

/**
 * 실제로 콘텐츠가 존재하는 로케일만 돌려준다.
 *
 * hreflang을 고정 목록으로 내보내면 아직 쓰지 않은 언어의 404 URL을 가리키게 되고,
 * 404를 가리키는 항목 하나가 hreflang 세트 전체를 무효화한다.
 * 콘텐츠에서 도출하면 Phase 2에서 ja/ko YAML을 추가하는 순간 자동으로 붙는다.
 *
 * 반환 순서는 astro.config.mjs 의 locales 순서를 따른다.
 */
export async function availableLocales(): Promise<Locale[]> {
  const entries = await getCollection('pages');
  const present = new Set(entries.map((e) => e.data.locale));
  return LOCALES.filter((l) => present.has(l));
}

/** x-default 대상. en 이 아직 없으면 존재하는 첫 로케일로 떨어진다. */
export function resolveXDefault(available: Locale[]): Locale | undefined {
  return available.includes(X_DEFAULT_LOCALE) ? X_DEFAULT_LOCALE : available[0];
}
