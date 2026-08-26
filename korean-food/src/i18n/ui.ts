import type { Locale } from '../lib/site';

/** 콘텐츠(YAML)가 아닌 **UI 문자열**. 언어별로 각각 작성하며 직역하지 않는다. */
export interface Ui {
  siteName: string;
  home: string;
  langNav: string;
  mainNav: string;
  faqHeading: string;
  sourcesHeading: string;
  by: string;
  lastUpdated: string;
  table: { dish: string; korean: string; pronunciation: string; spice: string; notes: string };
  /** {n} 은 0~4 로 치환된다. */
  spiceLabel: string;
  skipToContent: string;
}

export const UI: Record<Locale, Ui> = {
  en: {
    siteName: 'Korean Food Guide',
    home: 'Home',
    langNav: 'Language',
    mainNav: 'Main',
    faqHeading: 'Frequently Asked Questions',
    sourcesHeading: 'Sources',
    by: 'By',
    lastUpdated: 'Last updated',
    table: {
      dish: 'Dish',
      korean: 'Korean',
      pronunciation: 'Pronunciation',
      spice: 'Spice',
      notes: 'Notes',
    },
    spiceLabel: 'Spice level {n} out of 4',
    skipToContent: 'Skip to content',
  },
  ja: {
    siteName: '韓国料理ガイド',
    home: 'ホーム',
    langNav: '言語',
    mainNav: 'メイン',
    faqHeading: 'よくある質問',
    sourcesHeading: '出典',
    by: '執筆',
    lastUpdated: '最終更新',
    table: {
      dish: '料理',
      korean: '韓国語',
      pronunciation: '読み方',
      spice: '辛さ',
      notes: '説明',
    },
    spiceLabel: '辛さ 4 段階中 {n}',
    skipToContent: '本文へスキップ',
  },
  ko: {
    siteName: '한식 가이드',
    home: '홈',
    langNav: '언어',
    mainNav: '주 메뉴',
    faqHeading: '자주 묻는 질문',
    sourcesHeading: '출처',
    by: '글',
    lastUpdated: '최종 수정',
    table: {
      dish: '요리',
      korean: '한글',
      pronunciation: '로마자',
      spice: '맵기',
      notes: '설명',
    },
    spiceLabel: '맵기 4단계 중 {n}단계',
    skipToContent: '본문으로 건너뛰기',
  },
};

/** <time> 에 보일 사람이 읽는 날짜. datetime 속성은 항상 ISO 형식을 쓴다. */
export function formatDate(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}
