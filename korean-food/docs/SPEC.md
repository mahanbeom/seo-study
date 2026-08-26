# SPEC — `korean food` 다국어 SEO/AEO 페이지

> 최종 수정: 2026-08-26 · 상태: **Phase 1·3 완료 (영어판 배포 + 색인 등록)**, Phase 2 대기
>
> 배포: https://mahanbeom.github.io/seo-study/korean-food/en/

## 1. 무엇을 만드는가

`korean food` 계열 키워드를 타깃하는 **3개 언어(en/ja/ko) 정적 사이트**.
Astro + SSG로 빌드하고 GitHub Pages에 배포한다.

```
https://mahanbeom.github.io/seo-study/korean-food/en/   ← 최우선 타깃
https://mahanbeom.github.io/seo-study/korean-food/ja/
https://mahanbeom.github.io/seo-study/korean-food/ko/
```

각 언어 페이지는 **필러 가이드 + FAQ 결합 형식(A안)** 의 단일 장문 페이지다.

## 2. 왜 만드는가

목표가 두 층으로 나뉘며, **우선순위가 다르다.**

| 층       | 목표                                             | 판정 시점     |
| -------- | ------------------------------------------------ | ------------- |
| 표면     | `korean food` 구글 상위 노출 + AI 답변 인용 확보 | 3~6개월 후    |
| **궁극** | **SEO 지식을 갖췄음을 증명하는 포트폴리오**      | **제출 즉시** |

궁극 목표가 포트폴리오라는 점이 설계를 규정한다. 신규 도메인의 순위는 3~6개월이
걸리고 그마저 보장이 없으므로, **순위와 무관하게 즉시 평가 가능한 산출물**이
1급 결과물이다. 판단이 갈릴 때는 "설명 가능한 근거가 남는 쪽"을 택한다.

따라서 아래 셋은 부수 작업이 아니라 결과물이다.

- 이 `SPEC.md`와 §4의 의사결정 기록
- `scripts/verify-seo.mjs` — 체크리스트를 **코드로 강제**한 검증 스크립트
- 불일치를 구조적으로 차단하는 컴포넌트 설계 (§4.5)

## 3. 범위

### Phase 1 (이번 슬라이스)

- Astro 스캐폴딩, `output: 'static'`, i18n 라우팅, `base: '/seo-study/korean-food'`
- 공통 컴포넌트: `SEO.astro` / `JsonLd.astro` / `FAQ.astro`
- **영어 페이지 콘텐츠 완성** (본문 + FAQ 8~10개)
- sitemap (robots.txt 는 §4.9 참조 — 이 저장소에서 구현 불가)
- `scripts/verify-seo.mjs` + 로컬 검증 통과

### Phase 2

- **일본어판 — 번역 기반 + 도입부/FAQ만 현지 의도에 맞게 조정** (근거 §4.7)
- 한국어판 — 포트폴리오용 순수 번역. hreflang 다국어 구현 시연이 목적
- hreflang 상호 참조 완성

### Phase 3

- GitHub Pages 배포, Search Console / Bing Webmaster Tools 등록

### Phase 4 (4~8주 후)

- GSC 데이터 기반 개선, AI 인용 여부 수동 확인
- 성과 확인 시 C안(허브 & 스포크)으로 확장

### 비목표 (Non-goals)

- `korean food near me` 등 **로컬 검색** — 실제 사업체가 없어 타깃 불가
- 중국어판 — 중국 본토는 구글 차단으로 Trends 표본에 대표성이 없음
- 한국어판의 트래픽 — 국내에 "한국 음식" 검색 수요가 없음. 의도적으로 포기
- 동적 기능 일체 — `client:*` 디렉티브 사용 0건이 목표

## 4. 확정된 결정과 근거

### 4.1 Astro + SSG (`output: 'static'`)

판단 기준은 하나다 — **크롤러가 받는 첫 HTML에 본문이 있는가.**
`GPTBot` / `ClaudeBot` / `PerplexityBot` 등 AI 크롤러 상당수는 JS를 실행하지 않으므로,
AI 인용이 목표인 이상 초기 HTML 완결성은 선택이 아니라 전제 조건이다.
SSR도 이 조건은 만족하지만 TTFB에서 불리하고, 이 프로젝트에는 요청마다 달라져야 할
HTML이 없다. → SSG.

### 4.2 저장소명 `seo-study` 유지

`korean-food`로 rename하면 URL이 깔끔해지지만, 색인·순위·AI 인용 선택 어디에도
실질 영향이 없다. URL의 단어는 title/h1/본문의 중복 정보라 새 신호가 아니다.
반면 포트폴리오 독자가 실제로 읽는 것은 저장소 이름이며, `seo-study`가 의도를
더 정확히 전달한다.

### 4.3 실험 = 폴더 = URL 경로 (1:1)

저장소를 SEO 실험 모음집으로 쓰므로, 각 실험이 `/seo-study/` 루트를 점유하면
두 번째 실험에서 규칙이 깨진다. → `korean-food/` 폴더 ↔ `/seo-study/korean-food/`.

### 4.4 A안 (필러 가이드 + FAQ)

1. 신규 도메인 + 서브디렉터리 배포라 도메인 권위가 약하다. C안처럼 18페이지로
   분산하면 어느 것도 못 뜬다. 한 페이지에 신호를 집중시킨다.
2. A안의 각 `H2`가 그대로 C안 하위 페이지의 씨앗이 된다. 버리는 작업이 없다.
3. B안(리스티클)은 정의문이 없어 `"What is Korean food?"` 인용에 구조적으로 불리하다.

> 정정(2026-08-26): 지시서는 A안의 장점으로 "FAQPage 리치 결과 노출"을 들었으나,
> 이는 더 이상 유효하지 않다. §4.11 참조. 나머지 세 근거는 그대로이므로 결정은 바뀌지 않는다.

### 4.5 FAQ 컴포넌트는 단일 데이터 소스

JSON-LD와 화면 내용의 불일치는 스팸 정책 위반이다. 규율로 지키지 않고,
`FAQ.astro`가 **하나의 배열에서 화면 HTML과 `FAQPage` 스키마를 동시 생성**하게 해
구조적으로 불가능하게 만든다.

### 4.6 x-default = `en`

실제 검색 수요와 AI 인용 기회가 영어권에 있다. 언어 미매칭 사용자를 수요 없는
한국어판으로 보내지 않는다.

### 4.7 일본어판은 번역 기반 + 부분 현지화

검색 의도가 언어권마다 다르다. 미국 검색자는 한식을 **모르는** 상태(`뭘 먹어야 하나`)이고,
일본 검색자는 한식당이 흔한 환경에서 **이미 아는** 상태(`집에서 만들고 싶다`)다.
영어판을 그대로 번역하면 이미 아는 것을 설명하는 페이지가 되어 의도와 어긋난다.

전체 재작성이 정답이지만 Phase 2 작업량이 2~3배가 되고, 이 프로젝트의 궁극 목표(§2)는
일본어 트래픽이 아니라 포트폴리오다. → **번역을 기본으로 하되 도입부와 FAQ만 조정**한다.
언어 간 중복 콘텐츠는 페널티 대상이 아니며 hreflang이 처리하도록 설계된 정상 케이스다.

**가드레일**: 일본어판 조정은 `韓国料理` 주제 범위를 벗어나지 않는다. 드라마 문맥은
도입부 진입 훅으로만 쓰고 독립 섹션을 만들지 않는다. K뷰티는 일본어판에서 다루지
않는다 — 주제가 다르므로 별도 실험(`seo-study/k-beauty/`)에 속한다.
URL이 `korean-food`인 이상 콘텐츠도 한식을 벗어나면 안 된다.

### 4.8 사이트 범위를 `k-culture`로 넓히지 않는다

검토했으나 기각했다. (1) 신규 도메인에서 한 주제에 신호를 집중시키자는 §4.4의 근거를
정면으로 부정한다. (2) Trends 데이터에 `k-culture` 계열 검색어가 없다 — 실제 검색은
`korean food` / `韓国 ドラマ`처럼 개별 주제 단위로 일어난다. 마케팅 용어이지 검색어가
아니다. (3) 드라마 검색자와 요리법 검색자에게 같은 페이지를 줄 수 없다.
주제 확장은 URL을 넓히는 것이 아니라 §4.3의 폴더=경로 1:1 구조로 실험을 추가해 해결한다.

### 4.9 robots.txt 는 이 저장소에서 구현할 수 없다 (제약)

robots.txt 는 **오리진 루트에서만** 읽힌다. 이 사이트는 `mahanbeom.github.io/seo-study/`
아래의 프로젝트 페이지이므로, `public/robots.txt` 를 두면
`/seo-study/korean-food/robots.txt` 로 서빙되어 크롤러가 무시한다.
동작하지 않을 파일을 만들지 않는다.

확인 결과 `https://mahanbeom.github.io/robots.txt` 는 **404** 다. robots.txt 가 아예
없으므로 AI 크롤러는 이미 전부 허용된 상태이고, 지시서가 요구한 "AI 크롤러 허용"은
이미 충족돼 있다. 명시적 robots.txt 가 필요한 이유는 `Sitemap:` 지시자 하나뿐이며,
사이트맵은 Search Console 에 직접 제출할 수 있다.

→ **Phase 3 의 별도 저장소(`mahanbeom.github.io`) 작업**으로 넘긴다.

### 4.10 이미지는 CC/퍼블릭 도메인 자산으로 시작한다 (2026-08-26 해결)

Wikimedia Commons 에서 3장을 쓴다. **파일마다 API 로 실제 라이선스를 조회해 확인**했고,
추측으로 넣지 않았다. NC/ND 계열은 배제했다.

| 파일                     | 라이선스  | 저작자               |
| ------------------------ | --------- | -------------------- |
| `bapsang-table` (히어로) | CC BY 2.0 | egg (Hong, Yun Seon) |
| `bibimbap`               | CC0       | Andy Li              |
| `banchan`                | CC BY 2.0 | egg (Hong, Yun Seon) |

- 핫링크하지 않고 **자체 호스팅**한다. 상대가 파일을 옮기면 깨지고, 이미지 검색 신호도
  우리 도메인에 쌓이지 않는다.
- 출처 정보를 콘텐츠 스키마의 `credit` 블록으로 관리한다. 화면에 하드코딩하지 않는다.
- `og:image` 는 히어로를 1200×630 으로 잘라 `public/og/` 에 둔다. `src/assets` 가 아닌
  이유는 빌드마다 해시가 바뀌지 않는 **안정적인 절대 URL** 이어야 캐시된 소셜 카드가
  깨지지 않기 때문이다.

### 4.14 이미지 파일명은 출처가 아니라 내용을 기준으로 짓는다

나중에 직접 촬영한 사진으로 교체할 계획이 있다. **이미지 SEO 신호는 파일이 아니라
URL 에 붙으므로**, 같은 URL 에서 바이트만 갈아끼우면 손실이 0 이다. 반대로 파일명을
바꾸면 그 URL 에 쌓인 이미지 색인이 사라진다.

```
bapsang-table.jpg           ← 교체해도 URL 유지
bapsang-table-wikimedia.jpg ← 교체 = URL 변경 = 초기화
```

교체 시 절차는 두 단계다. (1) `src/assets/<같은이름>.jpg` 를 덮어쓴다.
(2) 콘텐츠의 `credit` 블록을 지운다 — CC BY 표기 의무가 사라지므로.
`credit` 이 있으면 화면에 반드시 렌더되는지를 검증 8-b 가 대조한다.

### 4.11 FAQPage 스키마는 Google 리치 결과와 무관하다 (2026-08-26 확인)

Google 은 2023년 9월 FAQ 리치 결과를 "공신력 있는 정부·의료 사이트"로 제한했고,
**2026년 5월 기능 자체를 폐지**했다(6월에 관련 문서도 삭제). 배포 후 Rich Results Test
로 확인한 결과도 동일하다 — 감지된 항목은 `Article` 과 `BreadcrumbList` 둘뿐이고
`FAQPage` 는 목록에 없다.

그럼에도 유지하는 이유는 세 가지다.

1. 이 프로젝트의 목표는 Google 리치 결과가 아니라 **AI 답변 인용**이다. LLM 은 구조화된
   Q&A 를 그대로 파싱한다.
2. 비용이 0 이다. `data.faq` 배열 하나에서 화면과 함께 생성되므로 추가 관리 부담이 없다.
3. Bing 등 다른 엔진의 처리 방식은 별개다.

**다만 인용을 실제로 만드는 것은 스키마가 아니라 화면의 질문형 `h3` 와 자기완결형 답변이다.**
스키마는 저비용 보조 수단으로 취급하고, 이것이 리치 결과를 준다고 기대하지 않는다.

### 4.12 JSON-LD 날짜는 시간대를 포함한 ISO 8601 로 쓴다

Rich Results Test 는 `2026-09-01` 같은 날짜만 있는 값에
"datetime 값이 잘못됨 / 시간대 누락" 경고를 낸다(경미, 선택사항). 완전한 ISO 8601
(`2026-09-01T00:00:00.000Z`)로 출력하면 사라진다. 화면의 `<time datetime>` 은
날짜만으로 충분하다 — HTML 스펙상 유효하고 사람이 읽는 값이기 때문이다.

### 4.13 사이트맵 `lastmod` 는 콘텐츠의 실제 수정일에서 가져온다

매 빌드마다 현재 시각을 넣으면 값은 늘 "최신"이 되지만, 크롤러는 곧 이 신호를
신뢰하지 않게 되고 **정말로 고쳤을 때 재크롤이 늦어진다.**

`astro.config.mjs` 에서는 `astro:content` 를 쓸 수 없으므로 콘텐츠 YAML 을 직접 읽어
`dateModified` 를 `serialize()` 에 주입한다. 검증 9번이 사이트맵의 `lastmod` 와
페이지 JSON-LD 의 `dateModified` 가 일치하는지 대조한다 — 두 값이 갈라지면 실패한다.

## 5. 완료 기준 (Definition of Done)

### Phase 1 — 자동 검증 (`npm run verify` · 11종, 실패 시 exit 1)

- [x] `dist/`의 각 HTML에 본문이 그대로 포함 (JS 실행 없이)
- [x] 첫 문단이 로케일별 **정의문 패턴**으로 시작
- [x] `export const prerender = false` 검색 결과 0건
- [x] `client:*` 디렉티브 0건 · 산출물에 `astro-island` 0건
- [x] canonical이 self · 절대경로 · 후행 슬래시
- [x] hreflang **상호 참조 완전** + `x-default` = en
- [x] hreflang이 빌드되지 않은 로케일을 가리키지 않음
- [x] JSON-LD가 유효한 JSON이며 `Article`/`FAQPage`/`BreadcrumbList`/`Organization` 포함
- [x] `Article.inLanguage`가 로케일과 일치, `mainEntityOfPage` = canonical
- [x] `datePublished`/`dateModified`가 시간대를 포함한 ISO 8601 (§4.12)
- [x] FAQ 스키마의 모든 질문·답변 텍스트가 화면 HTML에도 존재 (§4.5 검증)
- [x] 모든 `<img>`에 `alt`(15자 이상) + `width`/`height`
- [x] `og:image` 가 절대 URL 이고 `og:image:alt` 와 함께 있으며 dist 에 파일이 존재
- [x] `credit` 이 있는 이미지는 저작자·라이선스·원본 링크가 화면에 렌더됨 (§4.14)
- [x] `<h1>` 페이지당 1개, 헤딩 계층 건너뜀 없음
- [x] 사이트맵 인덱스가 존재하고 모든 로케일 URL을 포함
- [x] 사이트맵에 noindex 페이지가 없음
- [x] 사이트맵의 `lastmod` 가 존재하고 `Article.dateModified` 와 일치 (§4.13)
- [x] Search Console 소유권 확인 메타 태그가 속성 루트에 존재

> ⚠️ hreflang 개수를 3개로 고정하지 않는다. **콘텐츠가 존재하는 로케일에서 도출**한다.
> 아직 쓰지 않은 언어의 404 URL을 가리키면 hreflang 세트 전체가 무효화되기 때문이다.
> Phase 2에서 ja/ko YAML을 추가하면 자동으로 3개가 된다.
>
> ⚠️ 사이트맵 파일 구조는 `sitemap-index.xml` + `sitemap-0.xml` 이다. 지시서가 그린
> 언어별 `sitemap-en.xml` 구조는 `@astrojs/sitemap` 이 만들지 않으며, 한 사이트맵 안에
> `xhtml:link` hreflang을 넣는 현재 방식이 표준이다.

### Phase 1 — 수동 확인

- [x] Lighthouse 모바일 — **Performance 100 · Accessibility 100 · Best Practices 100 · SEO 100**
      (이미지 3장 추가 후 재측정: LCP 1.1s · CLS 0 · TBT 0ms, 로컬 preview 기준)
- [x] JS 없이 본문 정상 표시 — 산출물의 `<script>` 는 JSON-LD 하나뿐, 실행 코드 0KB
- [x] 모바일 375px에서 페이지 가로 스크롤 없음 (표만 자체 컨테이너 내부에서 스크롤)
- [x] **Rich Results Test (실제 URL, 2026-08-26)** — 유효한 항목 2개 감지
      · `글(Article)` 유효 · `탐색경로(BreadcrumbList)` 유효
      · `FAQPage` 는 감지 목록에 없음 — 기능 폐지 때문이며 마크업 오류가 아니다 (§4.11)
      · 경미한 경고: `image` 누락 (§4.10 미결) — 날짜 형식 경고 4건은 §4.12로 해결

### 콘텐츠 요건 (AEO)

- [ ] 첫 150자 안에 `Korean food is ~` 정의문
- [ ] 정의문에 엔티티(kimchi, doenjang, banchan, bapsang) + 구체적 수치 포함
- [ ] FAQ 각 답변이 질문 없이 단독으로 읽어도 완결
- [ ] 질문형 H2 사용 (`Is Korean Food Spicy?`)
- [ ] 1차 출처 링크 5개 이상 (한국관광공사, 농림축산식품부, 한식진흥원 등)
- [ ] 저자 + `<time datetime>` 최종 수정일 노출

### Phase 3 — 배포 후

- [ ] Search Console 접두어 속성 등록 → 사이트맵 제출 → 색인 확인
- [ ] Bing Webmaster Tools 등록 (AI 검색 다수가 Bing 인덱스 사용)

## 6. 측정

| 지표                   | 도구                                                           | 시점                    |
| ---------------------- | -------------------------------------------------------------- | ----------------------- |
| 색인 여부              | Search Console URL 검사                                        | 배포 +1~2주             |
| 노출 · CTR · 평균순위  | Search Console 실적                                            | +4~8주                  |
| Core Web Vitals (필드) | Search Console CWV                                             | +4주 (데이터 누적 필요) |
| AI 인용                | ChatGPT / Perplexity에 `what is korean food` 질의 후 출처 확인 | +8주                    |

**최소 3~6개월. 2주 만에 판단하지 않는다.**

## 7. 막힐 때 돌아올 기준

1. 크롤 → 렌더 → 색인 → 순위 → 클릭. 문제가 생기면 앞 단계부터 의심한다.
2. 색인이 안 되면 순위는 존재하지 않는다. 키워드 튜닝보다 색인 확인이 먼저다.
3. 검색 의도가 형식을 결정한다. 잘 쓴 글이 아니라 **원하는 형태의 글**이 이긴다.
4. canonical은 항상 self. 언어 간 교차는 색인 삭제를 부른다.
5. JSON-LD와 화면 내용은 일치해야 한다. 예외 없음.
6. AI 인용은 **정의문 + 자기완결성 + 구체적 수치**에서 나온다.
