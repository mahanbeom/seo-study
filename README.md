# seo-study

검색 노출과 **AI 답변 인용**을 대상으로 한 SEO/AEO 실험 저장소입니다.

목표가 두 층입니다. 표면 목표는 타깃 키워드의 구글 상위 노출과 AI 인용 확보이고,
궁극 목표는 **SEO 지식을 갖췄음을 증명하는 포트폴리오**입니다. 신규 도메인의 순위는
3~6개월이 걸리고 그마저 보장되지 않으므로, 순위와 무관하게 즉시 평가 가능한 것들
— 의사결정 기록과 **검증을 강제하는 코드** — 을 1급 산출물로 다룹니다.

## 실험

| 실험 | 타깃 | 배포 경로 | 상태 |
|---|---|---|---|
| [`korean-food/`](korean-food) | `korean food` / `韓国料理` (en·ja·ko) | `/seo-study/korean-food/{en,ja,ko}/` | Phase 1 완료 (영어판) |

실험 하나 = 폴더 하나 = URL 경로 하나로 1:1 대응합니다. 어느 실험도 `/seo-study/`
루트를 점유하지 않으므로 실험을 나란히 추가할 수 있습니다.

## 읽는 순서

1. **[`korean-food/docs/SPEC.md`](korean-food/docs/SPEC.md)** — 무엇을, 왜, 완료 기준. **§4에 결정과 그 근거**가 있습니다.
   SSG를 고른 이유, 저장소명을 바꾸지 않은 이유, 한국어판을 포트폴리오용으로 둔 이유 등.
2. **[`korean-food/scripts/verify-seo.mjs`](korean-food/scripts/verify-seo.mjs)** —
   이 저장소의 핵심입니다. SPEC의 완료 기준을 빌드 산출물에서 파싱해 검사하고,
   하나라도 실패하면 exit 1 을 냅니다. CI에서도 실행되어 **검증에 실패한 산출물은
   배포되지 않습니다.**
3. **[`korean-food/docs/metrics/`](korean-food/docs/metrics)** —
   배포마다 자동 기록되는 Lighthouse·Core Web Vitals·콘텐츠 규모 히스토리.
   어느 커밋에서 무엇이 꺾였는지 되짚을 수 있습니다. SEO·접근성이 기준선 미만이면
   CI 가 실패해 배포되지 않습니다.
4. **[`korean-food/src/content.config.ts`](korean-food/src/content.config.ts)** —
   콘텐츠 스키마. FAQ 배열 하나를 화면과 `FAQPage` JSON-LD가 함께 읽으므로
   "JSON-LD와 화면 내용 일치"가 규율이 아니라 구조로 보장됩니다.

## 실행

```bash
cd korean-food
pnpm install
pnpm dev        # 개발 서버
pnpm verify     # 빌드 + SEO 검사 11종 (실패 시 exit 1)
pnpm typecheck  # astro check
pnpm lint
pnpm metrics    # 빌드 + Lighthouse 측정 → docs/metrics 갱신
```

패키지 매니저는 **pnpm** 입니다. `packageManager` 필드로 버전이 고정돼 있어
corepack 이 자동으로 맞춰줍니다.

## Phase 1 검증 결과

```
pnpm verify      →  11개 검사 전체 통과
astro check      →  0 errors, 0 warnings
Lighthouse (모바일, 로컬 preview)
                 →  Performance 100 · Accessibility 100
                    Best Practices 100 · SEO 100
                    LCP 0.8s · CLS 0 · TBT 0ms
JS 번들          →  0KB (client:* 디렉티브 0건)
```

Lighthouse 점수는 참고치입니다. 실제 평가 기준은 배포 후 Search Console에 쌓이는
**CrUX 필드 데이터**입니다.

## 기술 선택

- **Astro + `output: 'static'`** — 판단 기준은 하나입니다. *크롤러가 받는 첫 HTML에
  본문이 있는가.* `GPTBot`·`ClaudeBot`·`PerplexityBot` 등 AI 크롤러 상당수는 JS를
  실행하지 않으므로, AI 인용이 목표인 이상 초기 HTML 완결성은 전제 조건입니다.
- **UI 프레임워크·웹폰트 없음** — 전달할 것이 콘텐츠뿐이라 하이드레이션할 대상이
  없습니다. 메인 스레드에 실행할 JS가 없으면 롱태스크도 없습니다.
- **콘텐츠는 Zod 스키마 YAML** — 로케일 하나라도 필수 항목이 빠지면 빌드가 실패합니다.
  언어별 콘텐츠 패리티가 사람의 주의력이 아니라 스키마로 보장됩니다.
