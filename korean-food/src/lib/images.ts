import type { ImageMetadata } from 'astro';

/**
 * 콘텐츠 YAML 의 `file` 값을 실제 자산으로 해석한다.
 *
 * 파일명은 **출처가 아니라 내용**을 기준으로 짓는다 (`bapsang-table`, `bibimbap`).
 * 나중에 직접 촬영한 사진으로 바꿀 때 같은 이름으로 덮어쓰면 URL 이 유지되고,
 * 이미지 검색에 쌓인 신호를 잃지 않는다. 파일명에 출처를 넣으면 교체가 URL 변경이 된다.
 *
 * eager glob 이라 빌드 타임에만 동작한다 — 클라이언트로 나가는 JS 는 없다.
 */
const assets = import.meta.glob<{ default: ImageMetadata }>('/src/assets/*.jpg', { eager: true });

export function imageAsset(file: string): ImageMetadata {
  const mod = assets[`/src/assets/${file}.jpg`];
  if (!mod) {
    const available = Object.keys(assets)
      .map((k) => k.replace('/src/assets/', '').replace('.jpg', ''))
      .join(', ');
    throw new Error(
      `이미지 자산이 없습니다: src/assets/${file}.jpg\n사용 가능: ${available || '(없음)'}`,
    );
  }
  return mod.default;
}
