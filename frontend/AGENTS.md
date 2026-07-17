# 프로젝트: 방방봐(방을 방송으로 봐)

## 프로젝트 구조

```
frontend/
├── docs/         # 기능 명세서, 코드 품질 기준 등 프로젝트 문서
├── public/       # 정적 자산 (이미지, 영상, 파비콘 등 빌드 시 그대로 복사되는 파일)
├── src/
│   ├── api/         # 백엔드 연동 함수 (도메인별 파일 분리, 현재는 인증 스텁만)
│   ├── context/      # 전역 상태를 다루는 React Context + Provider (인증, 테마 등)
│   ├── data/         # 목데이터, 셀렉트 옵션 등 정적 데이터
│   ├── lib/          # 도메인에 종속되지 않는 순수 유틸 함수 (포맷팅, 클래스명 병합 등)
│   ├── components/   # 두 페이지 이상에서 재사용되는 컴포넌트
│   │   └── ui/         # shadcn/ui로 생성한 프리미티브 컴포넌트
│   ├── pages/        # 라우트 하나당 파일 하나. 해당 페이지에서만 쓰는 하위 컴포넌트도 같이 둔다
│   ├── types.ts      # 여러 파일에서 공유하는 도메인 타입
│   ├── App.tsx       # 라우트 정의
│   ├── main.tsx      # 엔트리 포인트
│   └── index.css     # Tailwind 진입점 + 디자인 토큰(색상 변수) 정의
└── (설정 파일)   # eslint.config.mjs, .prettierrc, tsconfig*.json, vite.config.ts 등
```

- 새 페이지는 `src/pages/`에, 라우트는 `src/App.tsx`에 등록한다.
- 여러 페이지에서 재사용되는 컴포넌트는 `src/components/`, 페이지 전용 하위 컴포넌트는 해당 페이지 파일 안에 로컬로 둔다 (예: `PropertyDetailPage.tsx` 안의 `MemoSection`).
- shadcn/ui로 없는 컴포넌트만 `src/components/ui/`에 직접 추가하고, 항상 `pnpm dlx shadcn@latest add <component>` 결과 스타일(`data-slot`, `cva` 패턴)을 따른다.

## 기술 스택

- **언어**: TypeScript
- **프레임워크**: React 19
- **스타일링**: tailwind 4
- **패키지매니저**: pnpm
- **라이브러리**
  - **라우팅**: React Router
  - **서버 상태 캐싱**: Tanstack Query
  - **상태 관리**: Zustand
  - **지도**: Kakao Map API
  - **WebRTC**: Javascript의 기본 RTC

## 필수 참조

- 모든 UI 작업 전에 docs/frontend-spec.md의 기능명세서를 먼저 읽고 따를 것
- 디자인 토큰: 블루 계열 신뢰 톤, Tailwind 테마 변수 사용
- 스택: React + Vite + TypeScript + Tailwind (패키지 매니저: pnpm)

## 작업 규칙

- 섹션 단위로 구현하고, 각 섹션 완료 후 확인 요청
- 명세서에 없는 기능은 임의로 추가하지 말 것
- 코드 작업 시 eslint 규칙을 준수하도록 할 것
- 스타일링은 무조건 Tailwind CSS 방식으로
- 모든 프론트엔드 코드 작성/수정/리뷰 시 docs/frontend-code-quality의 4가지 기준에 충족하도록 할 것
- 파일 삭제 전 확인 요청
- 커스텀 훅, 함수, 파일 내 컴포넌트 구분을 위한 용도를 제외하고 주석을 달지 말 것
- 여러 컴포넌트에 재사용 가능한 함수는 `lib`, 커스텀 훅은 `hooks` 디렉토리에 분리해서 작성할 것
- 리포트에 가정치 금지. 실측 데이터만, 모르면 TBD 표시
- 상태를 `useState`로 직접 관리하기 전에, 같은 문제를 해결하는 React 최신 hook이 있는지 먼저 검토한다. 있으면 그쪽을 우선한다
  - 폼 제출 중 로딩 상태: `useState`로 `isLoading` 플래그를 만들지 말고 `useActionState`가 반환하는 `isPending`, 또는 폼 하위 컴포넌트라면 `useFormStatus`의 `pending`을 사용
  - 서버 요청 완료 전 UI 선반영(찜하기 토글, 메모 추가 등): 별도 임시 state로 흉내내지 말고 `useOptimistic`으로 낙관적 업데이트 처리
  - 폼 액션의 성공/실패 결과 상태: `useState` + `try/catch` 대신 `useActionState`의 반환값(state, formAction)을 사용
  - 그 외에도 `use()`, `useTransition` 등으로 더 간단히 표현되는 패턴이면 그것을 우선 검토하고, 마땅한 최신 hook이 없을 때만 `useState`/`useEffect` 조합으로 구현한다

## 디자인 규칙

- UI 컴포넌트는 shadcn/ui를 우선 사용 (Button, Card, Badge, Input, Select, Dialog, Tabs)
- shadcn/ui에 없는 것만 직접 구현하고, 스타일은 Tailwind 유틸리티만 사용
- 컬러: primary는 블루 계열(신뢰 톤), 텍스트·서피스는 slate 계열. CSS 변수(테마)로 정의
  - 라이트(배경 화이트)가 기본, 다크(slate-900 배경)는 GNB 토글로 전환 (ThemeContext + `.dark` 클래스)
  - 색상 추가·변경 시 index.css의 `:root`와 `.dark` 블록 양쪽에 정의할 것
- 폰트: IBM Plex Sans KR (index.html Google Fonts 로드, `--font-sans`) — design.pen과 동일. 한글 블록에는 word-break: keep-all 유지
- 타이포: 제목 font-semibold, 본문 font-normal, 크기 단계는 text-sm/base/lg/xl/2xl만 사용 (랜딩 히어로·섹션 제목은 예외)
- 간격은 4px 그리드(p-2/4/6/8), 카드 radius는 rounded-xl, 그림자는 shadow-sm까지만
  - 예외: 랜딩의 히어로 데모 카드·리포트 목업은 블루 틴티드 섀도우(rgba(22,93,252,…)) 사용 — 검정 그림자 금지
- 금지: 그라데이션 남발, 3색 이상 포인트 컬러, 이모지 아이콘(lucide-react 아이콘 사용)
- 레이아웃: 랜딩 섹션은 인접 섹션과 다른 패턴 사용(3등분 균일 카드 금지 — Bento·타임라인 등). 상세 원칙은 supanova-design-skill/redesign-skill/SKILL.md 참조
- UI 작업 시작 전 frontend-design 스킬(설치돼 있다면)을 로드해 미적 방향을 적용할 것

