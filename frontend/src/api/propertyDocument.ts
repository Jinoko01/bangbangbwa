import { api } from "@/api/client";
import type {
  DocumentStatus,
  DocumentType,
  PropertyDocument,
  RiskLevel,
} from "@/types";

// 매물 서류 등록·분석 (/api/properties/{propertyId}/documents)
// 중개사가 PDF를 올리면 서버가 AI 분석을 시작하고, 결과(위험도·요약)는 목록 조회로 받는다.
// documentType은 백엔드 enum의 한글 value를 그대로 주고받는다.

const documentsPath = (propertyId: number) =>
  `/api/properties/${propertyId}/documents`;

interface DocumentSummaryResponse {
  documentId: number;
  documentType: DocumentType;
  status: DocumentStatus;
  riskLevel?: RiskLevel | null;
  summary?: string | null;
  downloadable: boolean;
}

// 등록·교체 응답 — 분석이 아직 시작 단계라 위험도·요약이 없다
interface DocumentResponse {
  documentId: number;
  documentType: DocumentType;
  status: DocumentStatus;
}

function toPropertyDocument(dto: DocumentSummaryResponse): PropertyDocument {
  return {
    documentId: dto.documentId,
    documentType: dto.documentType,
    status: dto.status,
    riskLevel: dto.riskLevel ?? undefined,
    summary: dto.summary ?? undefined,
    downloadable: dto.downloadable,
  };
}

// 등록 직후는 항상 PROCESSING이라 다운로드할 분석 결과가 아직 없다
function toRegisteredDocument(dto: DocumentResponse): PropertyDocument {
  return { ...dto, downloadable: false };
}

export function getPropertyDocuments(
  propertyId: number,
  signal?: AbortSignal,
): Promise<PropertyDocument[]> {
  return api
    .get<DocumentSummaryResponse[] | null>({
      path: documentsPath(propertyId),
      config: { signal },
    })
    .then((documents) => documents?.map(toPropertyDocument) ?? []);
}

export function registerPropertyDocument(
  propertyId: number,
  documentType: DocumentType,
  file: File,
): Promise<PropertyDocument> {
  const formData = new FormData();
  formData.append("file", file);

  return api
    .post<DocumentResponse>({
      path: documentsPath(propertyId),
      body: formData,
      config: { params: { documentType } },
    })
    .then(toRegisteredDocument);
}

// 교체하면 서버가 새 파일로 재분석한다 — documentId는 그대로 유지된다
export function replacePropertyDocument(
  propertyId: number,
  documentId: number,
  file: File,
): Promise<PropertyDocument> {
  const formData = new FormData();
  formData.append("file", file);

  return api
    .put<DocumentResponse>({
      path: `${documentsPath(propertyId)}/${documentId}`,
      body: formData,
    })
    .then(toRegisteredDocument);
}

export function deletePropertyDocument(
  propertyId: number,
  documentId: number,
): Promise<void> {
  return api.delete<void>({
    path: `${documentsPath(propertyId)}/${documentId}`,
  });
}

// 분석 완료(downloadable) 서류만 받을 수 있다. 인증이 필요한 바이너리라 api.getBlob을 쓴다
export function downloadPropertyDocument(propertyId: number) {
  return api.getBlob({
    path: `${documentsPath(propertyId)}/download`,
  });
}
