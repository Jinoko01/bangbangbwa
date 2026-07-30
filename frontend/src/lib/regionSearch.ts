import { SEOUL_GUS } from "@/data/regions";

// "서울시 강남구 역삼동" 같은 지역 계층 입력을 구 필터와 나머지 검색어로 분리한다.
// 서울 표기는 서비스 지역 전체라 조건에서 제외하고, 구 이름과 정확히 일치하는
// 토큰만 sigungu로 승격한다 — 나머지(동 이름·매물명)는 그대로 검색어로 남긴다.
const SEOUL_TOKENS = new Set(["서울", "서울시", "서울특별시"]);

export interface ParsedRegionQuery {
  sigungu?: string;
  query?: string;
}

export function parseRegionQuery(raw: string): ParsedRegionQuery {
  const tokens = raw.trim().split(/\s+/).filter(Boolean);
  let sigungu: string | undefined;
  const rest: string[] = [];

  for (const token of tokens) {
    if (SEOUL_TOKENS.has(token)) {
      continue;
    }
    if (!sigungu && SEOUL_GUS.includes(token)) {
      sigungu = token;
      continue;
    }
    rest.push(token);
  }

  return { sigungu, query: rest.join(" ") || undefined };
}
