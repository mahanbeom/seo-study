#!/usr/bin/env node
/**
 * IndexNow 로 변경된 로케일 URL을 검색엔진에 통보한다 (SPEC.md §4.16).
 *
 * 사이트맵 제출은 "여기 URL이 있다"를 알릴 뿐이고 크롤 시점은 엔진이 정한다.
 * 신규 도메인 + 피인용 0 인 이 사이트는 그 대기열의 맨 뒤에 놓인다.
 * IndexNow 는 반대 방향이다 — 우리가 "지금 바뀌었다"를 밀어 넣는다.
 *
 * 사용법:
 *   node scripts/submit-indexnow.mjs            변경된 로케일만 (INDEXNOW_BEFORE 기준)
 *   node scripts/submit-indexnow.mjs --all      전체 로케일
 *   node scripts/submit-indexnow.mjs --dry-run  전송하지 않고 payload 만 출력
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DIR = join(ROOT, 'src/content/pages');
/** git pathspec 은 cwd 기준이다. 이 스크립트는 korean-food/ 에서 git 을 부른다. */
const CONTENT_PATH = 'src/content/pages';

// 응답 코드별 분기(성공 / 일시 오류 / 설정 오류)를 실제로 실행해 보려면 엔드포인트를
// 바꿔 끼울 수 있어야 한다. 운영에서는 항상 기본값이 쓰인다.
const ENDPOINT = process.env.INDEXNOW_ENDPOINT ?? 'https://api.indexnow.org/indexnow';

const args = process.argv.slice(2);
const ALL = args.includes('--all');
const DRY = args.includes('--dry-run');

const config = (await import(join(ROOT, 'astro.config.mjs'))).default;
const SITE = config.site.replace(/\/$/, '');
const BASE = config.base.replace(/\/$/, '');

function fail(message) {
  console.error(`\n  \x1b[31m✗\x1b[0m ${message}\n`);
  process.exit(1);
}

/**
 * GitHub Actions 실행 요약 화면에 배지로 남긴다.
 *
 * 스텝이 초록이면 200/202 였는지 429/5xx 를 경고로 넘긴 것인지 구분되지 않는다.
 * 로그를 열어야만 알 수 있는 차이는 결국 아무도 보지 않게 되므로,
 * 두 경우 모두 요약 화면에 남겨 열지 않고도 구분되게 한다.
 */
function annotate(level, title, message) {
  if (!process.env.GITHUB_ACTIONS) return;
  const esc = (v) => String(v).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  console.log(`::${level} title=${esc(title)}::${esc(message)}`);
}

/**
 * 키 파일이 곧 단일 출처다.
 *
 * 키를 스크립트에 적고 파일을 따로 두면 둘이 갈라지는 순간 제출이 403 으로 조용히
 * 죽는다. 파일명과 내용이 같아야만 통과하게 두면 갈라질 수가 없다.
 * verify-seo.mjs 검사 13 이 산출물에서 같은 규칙을 다시 확인한다.
 */
function readKey() {
  const files = readdirSync(join(ROOT, 'public')).filter((f) => f.endsWith('.txt'));
  if (files.length !== 1)
    fail(`public/ 의 .txt 키 파일이 ${files.length} 개입니다 (1 개여야 합니다).`);

  const name = files[0].replace(/\.txt$/, '');
  const body = readFileSync(join(ROOT, 'public', files[0]), 'utf8').trim();
  if (name !== body) fail(`키 파일명과 내용이 다릅니다 — 파일 "${name}" / 내용 "${body}"`);
  if (!/^[a-zA-Z0-9-]{8,128}$/.test(name))
    fail(`키 형식이 잘못됐습니다 (8~128 자 a-zA-Z0-9-) — "${name}"`);
  return name;
}

/** 빌드되는 로케일 = 콘텐츠 파일 이름. YAML 을 열어볼 필요가 없다. */
function allLocales() {
  return readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith('.yaml'))
    .map((f) => f.replace(/\.yaml$/, ''))
    .sort();
}

/**
 * 이번 푸시에서 실제로 내용이 바뀐 로케일만 고른다.
 *
 * IndexNow 는 "바뀐 URL 을 알리는" 프로토콜이다. 배포마다 전체를 밀어 넣으면
 * 할당량은 남아돌더라도 엔진 쪽에 "변하지도 않았는데 계속 부르는 사이트" 로 쌓인다.
 * 사이트맵 lastmod 가 콘텐츠 YAML 에서 나오므로(§4.13), 그 파일의 변경이 곧 기준이다.
 */
function changedLocales() {
  const before = (process.env.INDEXNOW_BEFORE ?? '').trim();
  if (!/^[0-9a-f]{40}$/.test(before) || /^0{40}$/.test(before)) return null;

  try {
    const out = execFileSync(
      'git',
      ['diff', '--name-only', `${before}..${process.env.GITHUB_SHA ?? 'HEAD'}`, '--', CONTENT_PATH],
      { cwd: ROOT, encoding: 'utf8' },
    );
    return out
      .split('\n')
      .map((line) => line.trim().match(/([a-z]{2})\.yaml$/)?.[1])
      .filter(Boolean)
      .sort();
  } catch (err) {
    console.warn(`  git diff 실패 — 전체를 제출합니다: ${err.message}`);
    return null;
  }
}

const key = readKey();
const locales = ALL ? allLocales() : (changedLocales() ?? allLocales());

if (locales.length === 0) {
  console.log('\n  변경된 로케일 콘텐츠가 없습니다 — IndexNow 제출을 건너뜁니다.\n');
  process.exit(0);
}

const payload = {
  host: new URL(SITE).host,
  key,
  // 호스트 루트를 쓸 수 없으므로 keyLocation 을 명시한다.
  // 이 파일이 놓인 디렉터리가 제출 가능 범위를 결정한다 (§4.16).
  keyLocation: `${SITE}${BASE}/${key}.txt`,
  urlList: locales.map((l) => `${SITE}${BASE}/${l}/`),
};

console.log(`\n  IndexNow → ${ENDPOINT}`);
console.log(`  keyLocation: ${payload.keyLocation}`);
for (const url of payload.urlList) console.log(`    · ${url}`);

if (DRY) {
  console.log('\n  --dry-run 이므로 전송하지 않습니다.\n');
  process.exit(0);
}

/**
 * 제출 전에 키 파일이 실제로 서빙되는지 확인한다.
 *
 * 엔진은 제출을 202 로 받아두고 키 검증을 **비동기로** 한다. 배포 직후라 키가 아직
 * 뜨지 않았으면 제출은 성공한 것처럼 보이고 검증만 조용히 실패한다.
 * 여기서 먼저 확인하면 그 실패가 즉시, 시끄럽게 드러난다.
 */
async function assertKeyLive(url, expected, attempts = 3, delayMs = 5000) {
  let last = '';
  for (let i = 1; i <= attempts; i++) {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (r.ok && (await r.text()).trim() === expected) {
        console.log(`  키 파일 확인 완료 (${i}/${attempts} 회차)`);
        return;
      }
      last = `HTTP ${r.status}`;
    } catch (err) {
      last = err.message;
    }
    if (i < attempts) {
      console.log(`  키 파일이 아직 안 보입니다 (${last}). ${delayMs / 1000}초 후 재시도…`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  fail(
    `키 파일을 가져올 수 없습니다 — ${url} (${last})\n      배포가 반영되지 않았거나 키가 dist 에 포함되지 않았습니다.`,
  );
}

await assertKeyLive(payload.keyLocation, key);

const res = await fetch(ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(payload),
});

const body = await res.text();

// 200 OK / 202 Accepted(키 검증 대기) 는 성공이다.
if (res.status === 200 || res.status === 202) {
  console.log(`\n  \x1b[32m✓\x1b[0m ${res.status} — ${locales.length} 개 URL 통보 완료\n`);
  annotate(
    'notice',
    'IndexNow',
    `${res.status} — ${locales.join(', ')} (${locales.length} 개 URL) 통보 완료`,
  );
  process.exit(0);
}

// 우리가 고칠 수 없는 일시적 사정은 배포를 빨갛게 만들 이유가 아니다.
if (res.status === 429 || res.status >= 500) {
  annotate(
    'warning',
    'IndexNow 미통보',
    `${res.status} 로 제출하지 못했습니다. 콘텐츠는 배포됐고 다음 배포에서 다시 시도합니다.`,
  );
  console.warn(
    `\n  \x1b[33m!\x1b[0m ${res.status} — 일시적 오류로 보입니다. 다음 배포에서 다시 시도합니다.\n  ${body.slice(0, 200)}\n`,
  );
  process.exit(0);
}

// 400/403/422 는 우리 설정이 틀렸다는 뜻이다 (키 불일치, 호스트 불일치, 범위 밖 URL).
fail(`IndexNow 제출 실패 ${res.status} — ${body.slice(0, 300)}`);
