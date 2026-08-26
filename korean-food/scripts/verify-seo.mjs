#!/usr/bin/env node
/**
 * SEO/AEO 완료 기준을 코드로 강제한다 (SPEC.md §5).
 *
 * 체크리스트를 사람이 읽고 지키는 것과, 빌드 산출물을 파싱해 실패 시 exit 1 을
 * 내는 것은 다르다. 이 프로젝트의 궁극 목표(SPEC §2)가 "SEO 지식을 증명하는
 * 포트폴리오"이므로, 이 스크립트가 페이지 자체보다 중요한 산출물이다.
 *
 * 사용법:  npm run verify   (astro build 후 실행)
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const SRC = join(ROOT, 'src');

const config = (await import(join(ROOT, 'astro.config.mjs'))).default;
const SITE = config.site.replace(/\/$/, '');
const BASE = config.base.replace(/\/$/, '');
const ORIGIN = `${SITE}${BASE}/`;

/** 각 로케일의 첫 문장이 정의문인지 — AI 인용의 전제 (SPEC §5 AEO). */
const DEFINITION_PATTERN = {
  en: /^Korean food is /,
  ja: /^韓国料理(と)?は/,
  ko: /^(한국 음식|한식)(은|이)/,
};

/** SPEC §5 콘텐츠 요건. */
const MIN = { faq: 8, dishes: 8, sources: 5 };

// ---------------------------------------------------------------- 결과 수집

const results = [];
let currentCheck = null;

function check(name, fn) {
  currentCheck = { name, failures: [] };
  results.push(currentCheck);
  try {
    fn();
  } catch (err) {
    currentCheck.failures.push(`검사 실행 중 오류: ${err.message}`);
  }
}

/** 조건이 거짓이면 실패로 기록한다. */
function expect(condition, message) {
  if (!condition) currentCheck.failures.push(message);
}

// ---------------------------------------------------------------- 산출물 수집

function walk(dir, filter) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full, filter) : filter(full) ? [full] : [];
  });
}

if (!existsSync(DIST)) {
  console.error('dist/ 가 없습니다. `astro build` 를 먼저 실행하세요.');
  process.exit(1);
}

const htmlFiles = walk(DIST, (f) => f.endsWith('.html'));

/** 로케일 페이지: dist/<locale>/index.html */
const localePages = htmlFiles
  .map((file) => {
    const rel = relative(DIST, file);
    const m = rel.match(/^([a-z]{2})[/\\]index\.html$/);
    if (!m) return null;
    const html = readFileSync(file, 'utf8');
    return { locale: m[1], file, rel, html, $: cheerio.load(html) };
  })
  .filter(Boolean);

const norm = (s) => s.replace(/\s+/g, ' ').trim();
const localeUrl = (l) => `${ORIGIN}${l}/`;

// ---------------------------------------------------------------- 검사

check('0. 로케일 페이지가 생성되었다', () => {
  expect(localePages.length > 0, 'dist 에 <locale>/index.html 이 하나도 없습니다.');
});

check('1. 초기 HTML에 본문이 들어있다 (SSG)', () => {
  for (const p of localePages) {
    const text = norm(p.$('main').text());
    expect(text.length > 200, `${p.rel}: <main> 본문이 비어 있거나 너무 짧습니다.`);

    const lede = norm(p.$('.lede').first().text());
    expect(lede.length > 100, `${p.rel}: .lede 정의 문단이 없습니다.`);

    const pattern = DEFINITION_PATTERN[p.locale];
    if (pattern) {
      expect(
        pattern.test(lede),
        `${p.rel}: 첫 문단이 정의문으로 시작하지 않습니다 (기대 패턴 ${pattern}).\n      실제: "${lede.slice(0, 80)}…"`,
      );
    }
  }
});

check('2. CSR로 새는 곳이 없다', () => {
  const sources = walk(SRC, (f) => /\.(astro|ts|tsx|js|mjs)$/.test(f));
  const CLIENT_DIRECTIVE = /\bclient:(load|idle|visible|media|only)\b/;
  const PRERENDER_OFF = /export\s+const\s+prerender\s*=\s*false/;

  for (const file of sources) {
    const body = readFileSync(file, 'utf8');
    expect(!PRERENDER_OFF.test(body), `${relative(ROOT, file)}: prerender = false 가 있습니다.`);
    expect(
      !CLIENT_DIRECTIVE.test(body),
      `${relative(ROOT, file)}: client:* 하이드레이션 디렉티브가 있습니다.`,
    );
  }

  for (const p of localePages) {
    expect(
      !p.html.includes('<astro-island'),
      `${p.rel}: astro-island 가 출력되었습니다 — 하이드레이션이 발생합니다.`,
    );
  }
});

check('3. 헤딩 구조', () => {
  for (const p of localePages) {
    const levels = p
      .$('h1,h2,h3,h4,h5,h6')
      .toArray()
      .map((el) => Number(el.tagName[1]));

    expect(
      p.$('h1').length === 1,
      `${p.rel}: <h1> 이 ${p.$('h1').length} 개입니다 (1개여야 합니다).`,
    );
    expect(levels[0] === 1, `${p.rel}: 첫 헤딩이 <h1> 이 아닙니다.`);

    for (let i = 1; i < levels.length; i++) {
      expect(
        levels[i] <= levels[i - 1] + 1,
        `${p.rel}: 헤딩 계층을 건너뜁니다 (h${levels[i - 1]} → h${levels[i]}).`,
      );
    }
  }
});

check('4. canonical = self · 절대경로 · 후행 슬래시', () => {
  for (const p of localePages) {
    const canonical = p.$('link[rel="canonical"]').attr('href');
    expect(canonical, `${p.rel}: canonical 이 없습니다.`);
    if (!canonical) continue;
    expect(canonical.startsWith('https://'), `${p.rel}: canonical 이 절대경로가 아닙니다.`);
    expect(canonical.endsWith('/'), `${p.rel}: canonical 에 후행 슬래시가 없습니다.`);
    expect(
      canonical === localeUrl(p.locale),
      `${p.rel}: canonical 이 self 가 아닙니다.\n      기대: ${localeUrl(p.locale)}\n      실제: ${canonical}`,
    );
  }
});

check('5. hreflang 상호 참조 + x-default', () => {
  const built = new Set(localePages.map((p) => p.locale));

  for (const p of localePages) {
    const links = p
      .$('link[rel="alternate"][hreflang]')
      .toArray()
      .map((el) => ({ lang: p.$(el).attr('hreflang'), href: p.$(el).attr('href') }));

    const langs = links.filter((l) => l.lang !== 'x-default').map((l) => l.lang);

    // 자기 자신 포함 — 빠지면 세트 전체가 무효화된다.
    expect(langs.includes(p.locale), `${p.rel}: 자기 자신(${p.locale}) hreflang 이 없습니다.`);

    // 빌드된 모든 로케일을 가리켜야 한다.
    for (const l of built) {
      expect(langs.includes(l), `${p.rel}: hreflang="${l}" 이 없습니다.`);
    }

    // 존재하지 않는 페이지를 가리키면 안 된다.
    for (const l of links) {
      if (l.lang === 'x-default') continue;
      expect(
        built.has(l.lang),
        `${p.rel}: hreflang="${l.lang}" 이 빌드되지 않은 페이지를 가리킵니다 (${l.href}).`,
      );
      expect(l.href?.startsWith('https://'), `${p.rel}: hreflang="${l.lang}" 이 상대경로입니다.`);
      expect(
        l.href === localeUrl(l.lang),
        `${p.rel}: hreflang="${l.lang}" URL 이 규칙과 다릅니다.`,
      );
    }

    const xDefault = links.find((l) => l.lang === 'x-default');
    expect(xDefault, `${p.rel}: x-default 가 없습니다.`);
    if (xDefault && built.has('en')) {
      expect(
        xDefault.href === localeUrl('en'),
        `${p.rel}: x-default 가 en 이 아닙니다 (SPEC §4.6).`,
      );
    }
  }
});

check('6. JSON-LD 구조화 데이터', () => {
  const REQUIRED = ['Article', 'FAQPage', 'BreadcrumbList', 'Organization'];

  for (const p of localePages) {
    const raw = p.$('script[type="application/ld+json"]').first().html();
    expect(raw, `${p.rel}: JSON-LD 가 없습니다.`);
    if (!raw) continue;

    let graph;
    try {
      graph = JSON.parse(raw);
    } catch (err) {
      currentCheck.failures.push(`${p.rel}: JSON-LD 파싱 실패 — ${err.message}`);
      continue;
    }

    const nodes = graph['@graph'] ?? [graph];
    const types = nodes.map((n) => n['@type']);
    for (const t of REQUIRED) {
      expect(types.includes(t), `${p.rel}: JSON-LD 에 ${t} 가 없습니다.`);
    }

    const article = nodes.find((n) => n['@type'] === 'Article');
    if (article) {
      expect(
        article.inLanguage === p.locale,
        `${p.rel}: Article.inLanguage 가 "${article.inLanguage}" 입니다 (기대 "${p.locale}").`,
      );
      expect(
        article.mainEntityOfPage === localeUrl(p.locale),
        `${p.rel}: Article.mainEntityOfPage 가 canonical 과 다릅니다.`,
      );
      expect(
        /^\d{4}-\d{2}-\d{2}$/.test(article.dateModified ?? ''),
        `${p.rel}: dateModified 형식 오류.`,
      );
    }
  }
});

check('7. FAQ 스키마 ↔ 화면 내용 일치 (SPEC §4.5)', () => {
  for (const p of localePages) {
    const raw = p.$('script[type="application/ld+json"]').first().html();
    if (!raw) continue;
    const nodes = JSON.parse(raw)['@graph'] ?? [];
    const faq = nodes.find((n) => n['@type'] === 'FAQPage');
    if (!faq) continue;

    const visible = norm(p.$('body').text());

    for (const q of faq.mainEntity ?? []) {
      expect(visible.includes(norm(q.name)), `${p.rel}: FAQ 질문이 화면에 없습니다 — "${q.name}"`);
      const answer = norm(q.acceptedAnswer?.text ?? '');
      expect(
        visible.includes(answer),
        `${p.rel}: FAQ 답변이 화면에 없습니다 — "${answer.slice(0, 60)}…"`,
      );
    }
  }
});

check('8. 이미지 alt · width · height (CLS)', () => {
  for (const p of localePages) {
    p.$('img').each((_, el) => {
      const $el = p.$(el);
      const src = $el.attr('src') ?? '(src 없음)';
      expect($el.attr('alt') !== undefined, `${p.rel}: <img> 에 alt 가 없습니다 — ${src}`);
      expect($el.attr('width'), `${p.rel}: <img> 에 width 가 없습니다 — ${src}`);
      expect($el.attr('height'), `${p.rel}: <img> 에 height 가 없습니다 — ${src}`);
    });
  }
});

check('9. 사이트맵', () => {
  const index = join(DIST, 'sitemap-index.xml');
  expect(existsSync(index), 'dist/sitemap-index.xml 이 없습니다.');
  if (!existsSync(index)) return;

  const xml = readFileSync(index, 'utf8');
  const parts = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  expect(parts.length > 0, 'sitemap-index.xml 에 <loc> 항목이 없습니다.');

  for (const part of parts) {
    const name = part.split('/').pop();
    const file = join(DIST, name);
    expect(existsSync(file), `사이트맵 인덱스가 없는 파일을 가리킵니다 — ${name}`);
    if (!existsSync(file)) continue;

    const body = readFileSync(file, 'utf8');
    for (const p of localePages) {
      expect(body.includes(localeUrl(p.locale)), `사이트맵에 ${localeUrl(p.locale)} 이 없습니다.`);
    }

    // noindex 페이지를 사이트맵에 제출하면 Search Console 이 경고를 낸다.
    for (const html of htmlFiles) {
      const $ = cheerio.load(readFileSync(html, 'utf8'));
      const robots = $('meta[name="robots"]').attr('content') ?? '';
      if (!/noindex/i.test(robots)) continue;

      const rel = relative(DIST, html)
        .replace(/index\.html$/, '')
        .replace(/\\/g, '/');
      const url = `${ORIGIN}${rel}`;
      expect(
        !body.includes(`<loc>${url}</loc>`),
        `사이트맵이 noindex 페이지를 제출합니다 — ${url}`,
      );
    }
  }
});

check('10. 콘텐츠 요건 (AEO)', () => {
  for (const p of localePages) {
    const faqCount = p.$('.faq-item').length;
    expect(faqCount >= MIN.faq, `${p.rel}: FAQ 가 ${faqCount} 개입니다 (${MIN.faq} 개 이상 필요).`);

    const dishCount = p.$('table tbody tr').length;
    expect(
      dishCount >= MIN.dishes,
      `${p.rel}: 요리 표가 ${dishCount} 행입니다 (${MIN.dishes} 행 이상 필요).`,
    );

    const sourceCount = p.$('.sources li a').length;
    expect(
      sourceCount >= MIN.sources,
      `${p.rel}: 출처 링크가 ${sourceCount} 개입니다 (${MIN.sources} 개 이상 필요).`,
    );

    // 질문형 헤딩 — 사용자 질의문과 형태를 일치시킨다.
    const questionHeadings = p
      .$('h2,h3')
      .toArray()
      .filter((el) => /[?？]\s*$/.test(norm(p.$(el).text())));
    expect(questionHeadings.length > 0, `${p.rel}: 질문형 헤딩이 하나도 없습니다.`);

    // 저자 + 최종 수정일
    expect(p.$('time[datetime]').length > 0, `${p.rel}: <time datetime> 최종 수정일이 없습니다.`);
  }
});

// ---------------------------------------------------------------- 출력

let failed = 0;
console.log(
  `\n  검증 대상: ${localePages.map((p) => p.locale).join(', ') || '(없음)'}  ·  ${ORIGIN}\n`,
);

for (const r of results) {
  if (r.failures.length === 0) {
    console.log(`  \x1b[32m✓\x1b[0m ${r.name}`);
  } else {
    failed += r.failures.length;
    console.log(`  \x1b[31m✗\x1b[0m ${r.name}`);
    for (const f of r.failures) console.log(`      \x1b[31m→\x1b[0m ${f}`);
  }
}

if (failed === 0) {
  console.log(`\n  \x1b[32m전체 통과\x1b[0m — ${results.length} 개 검사\n`);
  process.exit(0);
}

console.log(`\n  \x1b[31m${failed} 건 실패\x1b[0m — SPEC.md §5 완료 기준을 충족하지 않습니다.\n`);
process.exit(1);
