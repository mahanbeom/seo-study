import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * SPEC.md §4.5 — 화면 HTML과 JSON-LD의 유일한 출처.
 *
 * A안 페이지는 자유 산문이 아니라 구조화된 문서다(요리 표, FAQ 배열, 출처 목록).
 * 마크다운 본문으로 두면 FAQ를 화면과 FAQPage 스키마 양쪽에 쓸 때 두 벌이 생기고,
 * 그 순간 "JSON-LD와 화면 내용 일치" 요건이 규율의 문제가 된다.
 * 데이터 하나를 두 렌더러가 읽게 하면 불일치가 구조적으로 불가능해진다.
 *
 * 필수 필드로 선언한 항목은 로케일 하나라도 빠지면 빌드가 실패한다.
 * → 언어별 콘텐츠 패리티가 사람의 주의력이 아니라 스키마로 보장된다.
 */
/**
 * 이미지 출처 정보. CC BY 계열은 표기가 **의무**다.
 *
 * 이 블록을 데이터로 두는 이유는 나중에 직접 촬영한 사진으로 교체할 때
 * `credit` 만 지우면 끝나게 하기 위해서다. 화면 곳곳에 하드코딩하면 지울 곳을 찾아다녀야 한다.
 * scripts/verify-seo.mjs 가 credit 이 있는 이미지는 화면에 출처가 렌더되는지 대조한다.
 */
const credit = z.object({
  author: z.string().min(1),
  license: z.string().min(2),
  licenseUrl: z.string().url(),
  sourceUrl: z.string().url(),
});

const contentImage = z.object({
  /** src/assets/<file>.jpg. 출처가 아니라 내용을 기준으로 짓는다 (§4.14). */
  file: z.string().regex(/^[a-z0-9-]+$/),
  /** 의미 있는 대체 텍스트. 파일명 반복이 아니라 사진이 보여주는 것을 쓴다. */
  alt: z.string().min(15),
  caption: z.string().optional(),
  /** 직접 촬영한 사진이면 생략한다. */
  credit: credit.optional(),
});

const pages = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/pages' }),
  schema: z.object({
    locale: z.enum(['en', 'ja', 'ko']),

    /** SEO title. 언어별로 각각 작성하며 직역하지 않는다. */
    title: z.string().min(15).max(70),
    /** meta description. */
    description: z.string().min(50).max(180),

    h1: z.string().min(5),
    /**
     * 첫 문단. AI 인용 타깃이므로 정의문으로 시작해야 한다.
     * 검증은 scripts/verify-seo.mjs 가 로케일별 정의문 패턴으로 수행한다.
     */
    lede: z.string().min(100),

    /** 첫 화면 이미지. LCP 대상이며 og:image 와 짝을 이룬다. */
    hero: contentImage,

    sections: z
      .array(
        z.object({
          /** aria-labelledby 및 목차 앵커로 쓰인다. */
          id: z.string().regex(/^[a-z0-9-]+$/),
          heading: z.string().min(2),
          body: z.array(z.string().min(1)).min(1),
          /** 이 섹션 뒤에 끼워 넣을 특수 블록. */
          render: z.enum(['dish-table']).optional(),
          /** 섹션 본문 뒤에 붙는 이미지. */
          image: contentImage.optional(),
        }),
      )
      .min(1),

    dishes: z
      .array(
        z.object({
          name: z.string(),
          korean: z.string(),
          /** 영어 화자를 위한 발음 표기. 로마자 표기(RR)는 name 필드가 담당한다. */
          pronunciation: z.string(),
          /** 0 = 안 매움, 4 = 매우 매움. 표에 ●○ 로 렌더된다. */
          spice: z.number().int().min(0).max(4),
          note: z.string().min(10),
        }),
      )
      .min(1),

    /** 각 답변은 질문 없이 단독으로 읽어도 완결되어야 한다 (SPEC §5 AEO). */
    faq: z.array(z.object({ q: z.string().min(5), a: z.string().min(40) })).min(1),

    /** 1차 출처(정부·학술·공신력 기관). 실제 접속 확인된 URL만 넣는다. */
    sources: z.array(z.object({ label: z.string(), url: z.string().url() })).min(1),

    author: z.object({ name: z.string(), url: z.string().url() }),
    datePublished: z.coerce.date(),
    dateModified: z.coerce.date(),
  }),
});

export const collections = { pages };
