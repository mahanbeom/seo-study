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
import { parse as parseYaml } from 'yaml';

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
      // 날짜만 있는 값은 Google 이 "datetime 값이 잘못됨 / 시간대 누락" 경고를 낸다.
      // 시간대를 포함한 완전한 ISO 8601 을 요구한다.
      const ISO_WITH_TZ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
      for (const field of ['datePublished', 'dateModified']) {
        expect(
          ISO_WITH_TZ.test(article[field] ?? ''),
          `${p.rel}: Article.${field} 이 시간대를 포함한 ISO 8601 이 아닙니다 — "${article[field]}"`,
        );
      }
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

check('8. 이미지 alt · width · height · og:image', () => {
  for (const p of localePages) {
    expect(p.$('img').length > 0, `${p.rel}: 이미지가 하나도 없습니다.`);

    p.$('img').each((_, el) => {
      const $el = p.$(el);
      const src = $el.attr('src') ?? '(src 없음)';
      const alt = $el.attr('alt');
      expect(alt !== undefined, `${p.rel}: <img> 에 alt 가 없습니다 — ${src}`);
      expect(!alt || alt.trim().length >= 15, `${p.rel}: alt 가 너무 짧습니다 — "${alt}" (${src})`);
      expect($el.attr('width'), `${p.rel}: <img> 에 width 가 없습니다 — ${src}`);
      expect($el.attr('height'), `${p.rel}: <img> 에 height 가 없습니다 — ${src}`);
    });

    // 소셜 카드. 빌드 산출물에 실제 파일이 있어야 한다.
    const og = p.$('meta[property="og:image"]').attr('content');
    expect(og, `${p.rel}: og:image 가 없습니다.`);
    if (!og) continue;
    expect(og.startsWith('https://'), `${p.rel}: og:image 가 절대 URL 이 아닙니다 — ${og}`);
    expect(
      p.$('meta[property="og:image:alt"]').attr('content'),
      `${p.rel}: og:image:alt 가 없습니다.`,
    );

    const ogFile = join(DIST, og.replace(ORIGIN, ''));
    expect(existsSync(ogFile), `${p.rel}: og:image 파일이 dist 에 없습니다 — ${og}`);
  }
});

check('8-b. 이미지 출처 표기 (CC BY 의무)', () => {
  // 콘텐츠 YAML 과 렌더된 HTML 을 대조한다 — 서로 다른 산출물이라 순환 검증이 아니다.
  for (const p of localePages) {
    const yamlFile = join(SRC, 'content/pages', `${p.locale}.yaml`);
    if (!existsSync(yamlFile)) continue;

    const data = parseYaml(readFileSync(yamlFile, 'utf8'));
    const images = [data.hero, ...(data.sections ?? []).map((sec) => sec.image)].filter(Boolean);
    const visible = norm(p.$('body').text());
    const alts = p
      .$('img')
      .map((_, el) => norm(p.$(el).attr('alt') ?? ''))
      .get();

    for (const img of images) {
      expect(alts.includes(norm(img.alt)), `${p.rel}: alt 가 렌더되지 않았습니다 — ${img.file}`);
      if (!img.credit) continue;

      expect(
        visible.includes(norm(img.credit.author)),
        `${p.rel}: 저작자 표기가 화면에 없습니다 — ${img.file} / ${img.credit.author}`,
      );
      expect(
        visible.includes(norm(img.credit.license)),
        `${p.rel}: 라이선스 표기가 화면에 없습니다 — ${img.file} / ${img.credit.license}`,
      );
      expect(
        p.html.includes(img.credit.sourceUrl),
        `${p.rel}: 원본 링크가 화면에 없습니다 — ${img.file}`,
      );
    }
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

    // lastmod 는 실제 수정일이어야 한다. 거짓 값은 이 신호에 대한 신뢰를 깎고,
    // 정말로 고쳤을 때 재크롤을 늦춘다. JSON-LD 의 dateModified 와 일치하는지 본다.
    const entries = [...body.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => m[1]);
    for (const entry of entries) {
      const loc = entry.match(/<loc>([^<]+)<\/loc>/)?.[1];
      const lastmod = entry.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1];
      expect(lastmod, `사이트맵 항목에 <lastmod> 가 없습니다 — ${loc}`);
      if (!lastmod || !loc) continue;

      const page = localePages.find((p) => localeUrl(p.locale) === loc);
      if (!page) continue;

      const raw = page.$('script[type="application/ld+json"]').first().html();
      const article = (JSON.parse(raw ?? '{}')['@graph'] ?? []).find(
        (n) => n['@type'] === 'Article',
      );
      expect(
        new Date(lastmod).getTime() === new Date(article?.dateModified ?? 0).getTime(),
        `${loc}: lastmod 가 dateModified 와 다릅니다.\n      sitemap: ${lastmod}\n      article: ${article?.dateModified}`,
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

check('11. Search Console 소유권 확인 태그', () => {
  // 태그가 사라지면 소유권 확인이 조용히 풀리고 색인 데이터가 끊긴다.
  // 속성 루트(dist/index.html)에 반드시 있어야 한다.
  const root = join(DIST, 'index.html');
  expect(existsSync(root), 'dist/index.html (속성 루트) 이 없습니다.');
  if (!existsSync(root)) return;

  const token = cheerio
    .load(readFileSync(root, 'utf8'))('meta[name="google-site-verification"]')
    .attr('content');

  expect(token, '속성 루트에 google-site-verification 메타 태그가 없습니다.');
  expect(token && token.length > 20, `google-site-verification 토큰이 비정상입니다 — "${token}"`);
});

/**
 * 접힌 줄바꿈이 공백으로 새는 것을 막아야 하는 로케일.
 *
 * YAML 의 블록 스칼라(`>-`, `|`)는 줄바꿈을 **공백 한 칸으로 접는다.** 영어와 한국어는
 * 단어(어절)를 공백으로 구분하므로 줄을 공백 위치에서 끊는 한 무해하다. 일본어는 단어를
 * 공백으로 구분하지 않기 때문에 문장 한복판에 공백이 생긴다 — ja.yaml 초안에서 실제로
 * 87 곳이 이렇게 오염됐고, 육안으로는 알아채기 어려웠다.
 *
 * 대안은 큰따옴표 스칼라 + 줄 끝 `\` 연속이다. 이쪽은 줄바꿈을 공백 없이 잇는다.
 */
const NO_FOLD_LOCALES = ['ja'];

/** 일본어 조판에 존재하지 않는 조합 — 구두점에 붙은 공백. 오탐이 없다. */
const JA_STRAY_SPACE = /[、。（）「」・][ \t]|[ \t][、。（）「」・]/g;

check('12. 일본어 조판 — 접힌 줄바꿈이 공백으로 새지 않는다', () => {
  for (const locale of NO_FOLD_LOCALES) {
    // (1) 원인 차단 — 블록 스칼라를 아예 금지한다.
    const yamlFile = join(SRC, 'content/pages', `${locale}.yaml`);
    if (existsSync(yamlFile)) {
      readFileSync(yamlFile, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          expect(
            !/(?:^|\s)[|>][-+]?\d*\s*$/.test(line),
            `${locale}.yaml:${i + 1}: 블록 스칼라는 줄바꿈을 공백으로 접습니다. ` +
              `큰따옴표 + 줄 끝 \\ 연속으로 바꾸세요 — ${line.trim()}`,
          );
        });
    }

    // (2) 결과 확인 — 렌더된 본문에 흔적이 남지 않았는지 본다.
    //     문단 단위로 보는 이유는 요소 사이의 들여쓰기 공백을 오탐하지 않기 위해서다.
    const page = localePages.find((p) => p.locale === locale);
    if (!page) continue;

    const strays = new Set();
    page
      .$('main p, main li, main td, main th, main figcaption, main h1, main h2, main h3')
      .each((_, el) => {
        for (const hit of norm(page.$(el).text()).match(JA_STRAY_SPACE) ?? []) strays.add(hit);
      });
    expect(
      strays.size === 0,
      `${page.rel}: 일본어 구두점에 공백이 붙어 있습니다 — ` +
        [...strays].map((s) => JSON.stringify(s)).join(', '),
    );
  }
});

/**
 * 13. IndexNow 키 파일 (SPEC §4.16)
 *
 * IndexNow 는 키 파일이 **놓인 디렉터리**가 제출 가능한 URL 범위를 결정한다.
 * 키가 dist 루트(= /seo-study/korean-food/)에 있어야 /en/ /ja/ /ko/ 를 제출할 수 있고,
 * 하위 폴더로 옮기는 순간 모든 제출이 범위 밖이 되어 조용히 무효가 된다.
 *
 * 파일명과 내용이 갈라져도 마찬가지로 조용히 죽는다(403). 둘 다 여기서 막는다.
 * 제출 스크립트도 같은 규칙을 소스에서 확인하지만, 실제로 서빙되는 것은 dist 다.
 */
check('13. IndexNow 키 파일', () => {
  const txt = walk(DIST, (f) => f.endsWith('.txt')).map((f) => relative(DIST, f));

  expect(
    txt.length === 1,
    `dist 의 .txt 키 파일이 ${txt.length} 개입니다 (1 개여야 합니다) — ${txt.join(', ')}`,
  );
  if (txt.length !== 1) return;

  const rel = txt[0];
  if (rel.includes('/') || rel.includes('\\')) {
    // 여기서 멈춘다 — 경로가 섞인 이름으로 아래 검사를 이어가면 파생 실패만 늘어난다.
    expect(
      false,
      `키 파일이 하위 폴더에 있습니다 — ${rel}\n` +
        `      IndexNow 제출 범위가 그 폴더 이하로 좁아져 로케일 URL 이 전부 범위 밖이 됩니다.`,
    );
    return;
  }

  const key = rel.replace(/\.txt$/, '');
  const body = readFileSync(join(DIST, rel), 'utf8').trim();

  expect(key === body, `키 파일명과 내용이 다릅니다 — 파일 "${key}" / 내용 "${body}"`);
  expect(
    /^[a-zA-Z0-9-]{8,128}$/.test(key),
    `키 형식이 잘못됐습니다 (8~128 자 a-zA-Z0-9-) — "${key}"`,
  );
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
