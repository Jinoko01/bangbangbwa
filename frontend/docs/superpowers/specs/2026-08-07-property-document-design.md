# 매물 서류 등록·분석 조회 API 연동 설계

작성일: 2026-08-07

## 배경

백엔드에 매물 서류(PDF)를 등록하면 AI가 분석해 위험도와 요약을 돌려주는 엔드포인트가 열렸다. `docs/frontend-spec.md`에는 이 기능이 없어 화면 명세가 존재하지 않는다. 사용자 요청에 따라 두 화면에 붙인다.

- `/properties/new`, `/properties/:id/edit` — 중개사가 서류를 등록·교체·삭제
- `/properties/:id` — 등록된 서류와 분석 결과 조회, 분석 PDF 다운로드

## 실측한 API 계약

Swagger(`http://i15a504.p.ssafy.io:8081/v3/api-docs`) 2026-08-07 기준, 태그 `Property Document`.

| 메서드 | 경로 | 요청 | 응답 |
| --- | --- | --- | --- |
| POST | `/api/properties/{propertyId}/documents` | query `documentType`, multipart `file` | `DocumentResponse` |
| GET | `/api/properties/{propertyId}/documents` | — | `DocumentSummaryResponse[]` |
| PUT | `/api/properties/{propertyId}/documents/{documentId}` | multipart `file` | `DocumentResponse` |
| DELETE | `/api/properties/{propertyId}/documents/{documentId}` | — | `void` |
| GET | `/api/properties/{propertyId}/documents/{documentId}/download` | — | PDF 바이너리 |

### 스키마

- `DocumentResponse`: `documentId`, `documentType`, `status`
- `DocumentSummaryResponse`: `documentId`, `documentType`, `status`, `riskLevel`, `summary`, `downloadable`

### enum 값

Swagger는 세 필드를 모두 `type: string`으로만 노출한다. 실제 값은 백엔드 코드 기준으로 확인했다.

| 필드 | 값 | 비고 |
| --- | --- | --- |
| `documentType` | `등기부등본`, `건축물대장` | 요청·응답 모두 한글 value. `CONTRACT`는 백엔드에서 제거됨 |
| `status` | `PROCESSING`, `COMPLETED`, `FAILED` | 요청·응답 모두 영문 enum name |
| `riskLevel` | `안전`, `주의`, `위험` | 한글 value. 분석 전·실패 시 `null` |

`summary`도 분석 결과가 없으면 `null`, `downloadable`은 `status === "COMPLETED"`와 같은 뜻이다.

### 계약에서 나온 제약

1. **등록은 매물이 생성된 뒤에만 가능하다.** 경로에 `propertyId`가 필요하다. 매물 사진 업로드(`POST /api/properties/{id}/images`)와 같은 제약이므로 같은 흐름을 따른다.
2. **분석은 비동기다.** 등록 응답의 `status`는 `PROCESSING`이고, 결과는 목록을 다시 조회해야 나온다. 폴링이 필요하다.
3. **조회에도 인증이 필요하다.** 인증 없이 `GET /documents`를 호출하면 401이다. `/properties/:id` 상세는 비로그인도 볼 수 있는 공개 라우트라 분기가 필요하다.
4. **다운로드가 envelope가 아니다.** Bearer 인증이 필요한 바이너리 응답이라 기존 fetcher(`api.get`)로도, `lib/file.ts`의 `downloadFileFromUrl`(생 `fetch`)로도 받을 수 없다.
5. **교체(PUT)가 별도로 있다.** 같은 서류를 다시 올리는 행위를 신규 등록과 구분한다 — 서류를 종류별 1장으로 다루는 모델을 전제한 API다.

## 설계

### 도메인 모델 (`src/types.ts`)

```ts
export const DOCUMENT_TYPES = ["등기부등본", "건축물대장"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];
export type DocumentStatus = "PROCESSING" | "COMPLETED" | "FAILED";
export type RiskLevel = "안전" | "주의" | "위험";

export interface PropertyDocument {
  documentId: number;
  documentType: DocumentType;
  status: DocumentStatus;
  riskLevel?: RiskLevel;
  summary?: string;
  downloadable: boolean;
}
```

API 파일과 컴포넌트 양쪽에서 쓰이므로 `src/types.ts`로 승격한다(`docs/api-guide.md` 규칙).

### 통신 계층 (`src/api/client.ts`)

`api.getBlob<{ blob: Blob; fileName?: string }>({ path, config })`를 추가한다. 기존 fetcher는 envelope의 `data`를 벗겨 반환하므로 바이너리 응답에서 `undefined`가 된다.

- 내부에서 `responseType: "blob"` 고정 — 호출부에 axios 세부사항을 노출하지 않는다
- 파일명은 `Content-Disposition`의 `filename*`(RFC 5987) → `filename` 순으로 파싱, 없으면 `undefined`
- 응답 인터셉터의 에러 갈래에 **Blob 응답 분기**를 추가한다. 지금은 실패 응답의 body가 `Blob`이라 `body?.message`가 `undefined`가 되어 백엔드 메시지가 유실되고 "요청에 실패했습니다"로 덮인다. `Blob`이면 `await blob.text()` 후 JSON으로 파싱해 `ApiError`에 담는다

### 도메인 API (`src/api/propertyDocument.ts`)

엔드포인트 1:1 함수. 응답의 `null`을 `undefined`로 정규화하는 것 외의 변환은 없다.

```ts
getPropertyDocuments(propertyId, signal): Promise<PropertyDocument[]>
registerPropertyDocument(propertyId, documentType, file): Promise<PropertyDocument>
replacePropertyDocument(propertyId, documentId, file): Promise<PropertyDocument>
deletePropertyDocument(propertyId, documentId): Promise<void>
downloadPropertyDocument(propertyId, documentId): Promise<{ blob, fileName? }>
```

`documentType`은 한글 value를 그대로 쿼리 파라미터로 보낸다. 등록·교체 응답(`DocumentResponse`)에는 `riskLevel`·`summary`·`downloadable`이 없으므로 `downloadable: false`로 채워 `PropertyDocument`로 맞춘다 — 등록 직후는 항상 `PROCESSING`이라 사실과 일치한다.

### 서버 상태 (`src/hooks/queries/propertyDocumentQueries.ts`)

```ts
propertyDocumentKeys = {
  all: ["property-documents"],
  lists: () => [...all, "list"],
  list: (propertyId) => [...lists(), propertyId],
}
```

`propertyDocumentListOptions(propertyId)`의 `refetchInterval`을 함수로 준다. 목록에 `PROCESSING`이 하나라도 있으면 `5_000`, 아니면 `false`. 분석이 끝나면 폴링이 스스로 멈춘다.

훅: `usePropertyDocuments(propertyId, enabled)`, `useRegisterPropertyDocument`, `useReplacePropertyDocument`, `useDeletePropertyDocument`, `useDownloadPropertyDocument`.

- 변경 훅은 성공 시 `propertyDocumentKeys.list(propertyId)`를 무효화한다. 낙관적 업데이트는 하지 않는다 — 분석 결과는 서버만 알고, 목록이 두 줄이라 체감 지연이 없다
- 다운로드는 `useMutation`으로 두어 `isPending`으로 중복 클릭을 막는다

### 공용 컴포넌트

| 파일 | 역할 |
| --- | --- |
| `src/components/DocumentStatusBadge.tsx` | `COMPLETED`면 위험도, `PROCESSING`·`FAILED`면 상태를 배지로 |
| `src/components/PropertyDocumentSection.tsx` | 상세 페이지용 읽기 + 다운로드 |
| `src/components/PropertyDocumentFields.tsx` | 폼 페이지용 편집 슬롯 |

두 페이지 파일이 이미 1,100줄대라 페이지 안에 하위 컴포넌트로 넣지 않고 분리한다.

배지 톤은 기존 `AgentVerificationStatusBadge`의 `TONE` 맵 + 점(dot) 패턴을 그대로 따른다. 색만으로 뜻을 전달하지 않도록 라벨 텍스트를 항상 함께 보여준다.

| 표시 | 톤 |
| --- | --- |
| 안전 | emerald |
| 주의 | amber |
| 위험 | red |
| 분석 중 | slate(muted) |
| 분석 실패 | red |

### 서류 모델: 종류별 1장 슬롯

등기부등본·건축물대장 두 슬롯을 고정으로 두고, 각 슬롯은 비어 있거나 서류 1건을 갖는다. PUT(교체) API가 있는 이유와 맞고, 세입자가 어떤 서류가 빠졌는지 바로 알 수 있다. 응답에 같은 종류가 여러 건 오면 첫 번째만 슬롯에 넣는다.

### 폼 화면 (`/properties/new`, `/properties/:id/edit`)

"사진" 아래에 "서류" `FormSection`을 추가한다. 사진과 같은 규칙 — **고르면 로컬에 담기고, 저장을 눌러야 서버에 반영된다.**

| 슬롯 상태 | 저장 시 |
| --- | --- |
| 빈 슬롯 + 새 파일 | `POST ?documentType=<종류>` |
| 기존 서류 + 새 파일 | `PUT .../{documentId}` |
| 기존 서류 + 삭제 표시 | `DELETE .../{documentId}` |
| 변화 없음 | 요청 없음 |

수정 화면은 `usePropertyDocuments(propertyId)`로 기존 서류를 불러와 슬롯을 채운다. 신규 등록 화면은 매물이 아직 없으므로 조회하지 않고 빈 슬롯에서 시작한다.

제출 순서는 `매물 생성·수정 → 사진 업로드 → 서류 반영`이다. 서류만 실패하면 매물과 사진은 이미 저장된 상태이므로, 기존 `createdPropertyId` 재시도 메커니즘을 그대로 써서 "매물은 저장됐지만 서류 등록에 실패했어요. 저장을 다시 누르면 서류만 다시 올립니다"를 보여준다.

이때 **사진 업로드가 성공한 draft의 `file` 참조를 비운다.** 지금은 사진 업로드 뒤에 실패할 단계가 없어 드러나지 않지만, 서류 단계를 뒤에 붙이면 재제출 시 같은 사진이 다시 올라간다. 이 변경이 만드는 문제이므로 함께 고친다.

검증은 `src/lib/propertyValidation.ts`에 `validateDocumentFile`을 추가한다. `accept` 속성은 우회 가능하므로 MIME(`application/pdf`)과 크기를 직접 확인하고, `PROPERTY_LIMITS.documentMaxSizeMb: 10`을 추가한다.

### 상세 화면 (`/properties/:id`)

`NearbyFacilitiesSection` 위에 `PropertyDocumentSection`을 둔다 — 매물 정보 → 서류 신뢰도 → 주변 환경 순서.

- **비로그인**: 요청을 보내지 않고(`enabled: false`) "로그인하면 AI 서류 분석 결과를 확인할 수 있어요" + 로그인 버튼. 401로 로컬 토큰이 지워지는 부작용도 함께 피한다
- **로그인**: 두 슬롯을 항상 렌더
  - `COMPLETED` — 위험도 배지 + `summary` + `분석 PDF 받기` 버튼(`downloadable` 기준)
  - `PROCESSING` — "AI가 서류를 분석하고 있어요" + 5초 폴링. 영역에 `aria-live="polite"`를 걸어 완료 시 보조기술에도 전달
  - `FAILED` — "분석에 실패했어요". 중개사에게는 매물 수정에서 교체하라고 안내
  - 미등록 — "등록된 서류가 없어요". 중개사에게는 매물 수정 링크
- **조회 실패**: 섹션 안에만 재시도 버튼을 두고 페이지 전체는 막지 않는다
- **다운로드 실패**: 섹션 안에 `role="alert"` 문구, 버튼은 그대로 두어 재시도 가능

다운로드 파일명은 `Content-Disposition`을 우선하고, 없으면 `{매물명}_{서류종류}_분석.pdf`로 만든다. 매물명은 `PropertyDetailPage`가 이미 가진 값을 prop으로 내려준다.

## 검증

`pnpm lint`와 `pnpm build`를 실행한다. 실제 등록·분석 흐름은 중개사 승인 계정과 실제 PDF가 필요해 이 작업 범위에서 전 구간을 확인할 수 없다 — 확인하지 못한 항목은 작업 리포트에 그대로 남긴다.

## 범위 밖

- 서류 종류 추가(백엔드 enum에 없음)
- 같은 종류 여러 장 등록
- 분석 결과 원문 뷰어 — 다운로드만 제공한다
- `docs/frontend-spec.md`에 이 기능을 추가하는 문서 작업
