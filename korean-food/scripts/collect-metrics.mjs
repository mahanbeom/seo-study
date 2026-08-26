#!/usr/bin/env node
/**
 * 배포 시점의 SEO/성능 지표를 기록한다.
 *
 * 왜 필요한가 — 성능 회귀는 배포 순간에는 보이지 않는다. 몇 주 뒤 "느려졌다"고
 * 느꼈을 때 어느 커밋이 원인인지 되짚을 방법이 없으면 추측만 남는다.
 * 배포마다 같은 조건으로 재서 남겨두면 어느 변경에서 무엇이 꺾였는지 대조할 수 있다.
 *
 * 산출물 두 가지:
 *   docs/metrics/history.jsonl  기계용. 한 줄 = 한 배포. append-only.
 *   docs/metrics/README.md      사람용. history.jsonl 에서 매번 다시 생성한다.
 *
 * 사용법:  pnpm metrics        (빌드 후 실행)
 */

import { spawn, execSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  appendFileSync,
  writeFileSync,
  statSync,
  readdirSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const OUT_DIR = join(ROOT, 'docs', 'metrics');
const HISTORY = join(OUT_DIR, 'history.jsonl');
const PORT = 4331;

const config = (await import(join(ROOT, 'astro.config.mjs'))).default;
const BASE = config.base.replace(/\/$/, '');
const TARGET_PATH = `${BASE}/en/`;

/**
 * SEO·접근성만 게이트한다.
 *
 * 성능 점수는 CI 러너의 부하에 따라 몇 점씩 흔들린다. 그걸로 빌드를 막으면
 * 무관한 실패가 쌓이고 결국 아무도 안 보게 된다. 성능은 **기록만** 하고,
 * 추세는 history 로 판단한다. 반면 SEO·접근성은 대부분 구조적 검사라 재현성이 높다.
 */
const GATE = { seo: 100, accessibility: 95 };

// ---------------------------------------------------------------- 미리보기 서버

function waitForPort(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const res = await fetch(url);
        if (res.ok) return resolve();
      } catch {
        /* 아직 안 떴다 */
      }
      if (Date.now() > deadline) return reject(new Error(`서버가 뜨지 않습니다: ${url}`));
      setTimeout(tick, 300);
    };
    tick();
  });
}

async function withPreview(fn) {
  // node_modules/.bin/astro 를 쓴다. pnpm 의 엄격한 구조에서는 astro 패키지가
  // 스토어에 있어 node_modules/astro/... 경로로 직접 지정할 수 없다.
  const bin = join(ROOT, 'node_modules', '.bin', 'astro');
  const server = spawn(bin, ['preview', '--port', String(PORT)], {
    cwd: ROOT,
    stdio: 'ignore',
  });
  try {
    await waitForPort(`http://localhost:${PORT}${TARGET_PATH}`);
    return await fn(`http://localhost:${PORT}${TARGET_PATH}`);
  } finally {
    server.kill();
  }
}

// ---------------------------------------------------------------- 수집

async function runLighthouse(url) {
  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const { lhr } = await lighthouse(url, { port: chrome.port, output: 'json', logLevel: 'error' });
    return lhr;
  } finally {
    await chrome.kill();
  }
}

function dirBytes(dir) {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).reduce((sum, name) => {
    const full = join(dir, name);
    const st = statSync(full);
    return sum + (st.isDirectory() ? dirBytes(full) : st.size);
  }, 0);
}

/** 콘텐츠 규모. 성능 변화가 콘텐츠 증가 때문인지 코드 때문인지 구분하는 데 쓴다. */
function contentStats() {
  const file = join(DIST, 'en', 'index.html');
  if (!existsSync(file)) return {};
  const html = readFileSync(file, 'utf8');
  const $ = cheerio.load(html);
  $('script, style').remove();
  return {
    words: $('main').text().trim().split(/\s+/).filter(Boolean).length,
    faq: $('.faq-item').length,
    dishes: $('table tbody tr').length,
    sources: $('.sources li a').length,
    images: $('img').length,
    htmlBytes: Buffer.byteLength(html),
  };
}

function git(cmd) {
  try {
    return execSync(`git ${cmd}`, { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------- 실행

const RENDER_ONLY = process.argv.includes('--render-only');

mkdirSync(OUT_DIR, { recursive: true });

if (!RENDER_ONLY && !existsSync(DIST)) {
  console.error('dist/ 가 없습니다. `astro build` 를 먼저 실행하세요.');
  process.exit(1);
}

const lhr = RENDER_ONLY ? null : await withPreview(runLighthouse);

const score = (id) => Math.round((lhr?.categories[id]?.score ?? 0) * 100);
const metric = (id) => Math.round(lhr?.audits[id]?.numericValue ?? 0);

const failing = Object.entries(lhr?.audits ?? {})
  .filter(([, a]) => a.score !== null && a.score < 1 && a.scoreDisplayMode === 'binary')
  .map(([id]) => id);

const record = RENDER_ONLY
  ? null
  : {
      date: new Date().toISOString().slice(0, 19) + 'Z',
      commit: git('rev-parse --short HEAD') || 'unknown',
      subject: git('log -1 --pretty=%s').slice(0, 80),
      scores: {
        performance: score('performance'),
        accessibility: score('accessibility'),
        bestPractices: score('best-practices'),
        seo: score('seo'),
      },
      vitals: {
        lcpMs: metric('largest-contentful-paint'),
        cls: Number((lhr.audits['cumulative-layout-shift']?.numericValue ?? 0).toFixed(3)),
        tbtMs: metric('total-blocking-time'),
        fcpMs: metric('first-contentful-paint'),
      },
      weight: {
        totalBytes: dirBytes(DIST),
        astroBytes: dirBytes(join(DIST, '_astro')),
      },
      content: contentStats(),
      failingAudits: failing,
    };

if (record) appendFileSync(HISTORY, JSON.stringify(record) + '\n');

// ---------------------------------------------------------------- README 생성

const rows = readFileSync(HISTORY, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line));

const kb = (n) => `${(n / 1024).toFixed(0)}KB`;
const delta = (curr, prev, unit = '', lowerIsBetter = false) => {
  if (prev === undefined || prev === null || curr === prev) return '';
  const diff = curr - prev;
  const improved = lowerIsBetter ? diff < 0 : diff > 0;
  const sign = diff > 0 ? '+' : '';
  return ` ${improved ? '🟢' : '🔴'}${sign}${diff}${unit}`;
};

const scoreCell = (r, prev, key) => `${r.scores[key]}${delta(r.scores[key], prev?.scores?.[key])}`;

const lines = [
  '# 배포 지표 히스토리',
  '',
  '배포마다 자동 기록됩니다. 원본 데이터는 [`history.jsonl`](history.jsonl) 이고,',
  '이 문서는 매 실행 시 그 파일에서 다시 생성됩니다. **직접 수정하지 마세요.**',
  '',
  '측정 조건은 로컬/CI 모두 `astro preview` + Lighthouse 모바일 기본 스로틀링으로 동일합니다.',
  '',
  '> ⚠️ **성능 점수는 러너 부하에 따라 몇 점씩 흔들립니다.** 한 번의 하락이 아니라',
  '> **추세**로 읽으세요. 반대로 SEO·접근성은 구조적 검사라 재현성이 높고, 기준선',
  `> (SEO ${GATE.seo} / 접근성 ${GATE.accessibility}) 미만이면 빌드가 실패합니다.`,
  '',
  '> 실제 순위 평가 기준은 Lighthouse 가 아니라 Search Console 의 **CrUX 필드 데이터**입니다.',
  '> 이 표는 회귀를 조기에 잡기 위한 실험실 지표입니다.',
  '',
  '## 점수',
  '',
  '| 날짜 | 커밋 | 성능 | 접근성 | 권장사항 | SEO | 변경 |',
  '|---|---|---|---|---|---|---|',
];

const reversed = [...rows].reverse();
for (let i = 0; i < reversed.length; i++) {
  const r = reversed[i];
  const prev = reversed[i + 1];
  lines.push(
    `| ${r.date.slice(0, 10)} | \`${r.commit}\` | ${scoreCell(r, prev, 'performance')} | ` +
      `${scoreCell(r, prev, 'accessibility')} | ${scoreCell(r, prev, 'bestPractices')} | ` +
      `${scoreCell(r, prev, 'seo')} | ${r.subject} |`,
  );
}

lines.push('', '## Core Web Vitals (실험실)', '');
lines.push('| 날짜 | 커밋 | LCP | CLS | TBT | 총 용량 | 이미지/JS | 단어 수 |');
lines.push('|---|---|---|---|---|---|---|---|');
for (let i = 0; i < reversed.length; i++) {
  const r = reversed[i];
  const prev = reversed[i + 1];
  lines.push(
    `| ${r.date.slice(0, 10)} | \`${r.commit}\` | ${r.vitals.lcpMs}ms` +
      `${delta(r.vitals.lcpMs, prev?.vitals?.lcpMs, 'ms', true)} | ${r.vitals.cls} | ` +
      `${r.vitals.tbtMs}ms | ${kb(r.weight.totalBytes)} | ${kb(r.weight.astroBytes)} | ` +
      `${r.content.words ?? '-'}${delta(r.content.words, prev?.content?.words)} |`,
  );
}

const withFailures = reversed.filter((r) => r.failingAudits.length > 0);
if (withFailures.length > 0) {
  lines.push('', '## 만점을 놓친 감사 항목', '');
  lines.push('점수가 100 미만이면 원인이 여기 남습니다.', '');
  for (const r of withFailures) {
    lines.push(`- \`${r.commit}\` (${r.date.slice(0, 10)}) — ${r.failingAudits.join(', ')}`);
  }
}

lines.push('');
writeFileSync(join(OUT_DIR, 'README.md'), lines.join('\n'));

// ---------------------------------------------------------------- 출력

if (!record) {
  console.log(`\n  README 를 ${rows.length}건에서 다시 생성했습니다.\n`);
  process.exit(0);
}

console.log(`\n  ${record.commit}  ${record.date}`);
console.log(
  `  성능 ${record.scores.performance} · 접근성 ${record.scores.accessibility} · 권장사항 ${record.scores.bestPractices} · SEO ${record.scores.seo}`,
);
console.log(
  `  LCP ${record.vitals.lcpMs}ms · CLS ${record.vitals.cls} · TBT ${record.vitals.tbtMs}ms · ${record.content.words} words`,
);
if (failing.length) console.log(`  감점: ${failing.join(', ')}`);
console.log(`\n  기록: docs/metrics/history.jsonl (총 ${rows.length}건)\n`);

const gateFailures = Object.entries(GATE).filter(
  ([key, min]) => score(key === 'accessibility' ? 'accessibility' : key) < min,
);
if (gateFailures.length) {
  for (const [key, min] of gateFailures) {
    console.error(`  \x1b[31m✗\x1b[0m ${key} 점수가 기준선 ${min} 미만입니다 (${score(key)}).`);
  }
  process.exit(1);
}
