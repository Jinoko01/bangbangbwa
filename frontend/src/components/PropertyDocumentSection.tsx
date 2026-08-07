import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Download, FileText, Lock } from "lucide-react";

import DocumentStatusBadge from "@/components/DocumentStatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useDownloadPropertyDocument,
  usePropertyDocuments,
} from "@/hooks/queries/propertyDocumentQueries";
import {
  DOCUMENT_TYPES,
  type DocumentType,
  type PropertyDocument,
} from "@/types";

function SectionCard({ children }: { children: ReactNode }) {
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="gap-0 px-4">
        <div className="flex items-baseline justify-between gap-3">
          <CardTitle className="text-base">서류 분석</CardTitle>
          <p className="text-xs text-muted-foreground">
            AI가 확인한 권리관계 요약
          </p>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 px-4">{children}</CardContent>
    </Card>
  );
}

function describeDocument(
  document: PropertyDocument | undefined,
  canManage: boolean,
) {
  if (!document) {
    return "아직 등록된 서류가 없어요";
  }
  if (document.status === "PROCESSING") {
    return "AI가 서류를 분석하고 있어요. 잠시 후 결과가 표시됩니다";
  }
  if (document.status === "FAILED") {
    return canManage
      ? "분석에 실패했어요. 매물 수정에서 서류를 다시 올려주세요"
      : "분석에 실패한 서류예요";
  }
  return document.summary ?? "분석 요약이 제공되지 않았어요";
}

function DocumentSlot({
  documentType,
  document,
  propertyId,
  propertyTitle,
  canManage,
}: {
  documentType: DocumentType;
  document?: PropertyDocument;
  propertyId: number;
  propertyTitle: string;
  canManage: boolean;
}) {
  const {
    mutate: download,
    isPending: isDownloading,
    isError: isDownloadError,
  } = useDownloadPropertyDocument();

  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 gap-3">
        <FileText
          aria-hidden
          className="mt-0.5 size-5 shrink-0 text-muted-foreground"
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{documentType}</span>
            {document && (
              <DocumentStatusBadge
                status={document.status}
                riskLevel={document.riskLevel}
              />
            )}
          </div>
          {/* 분석은 서버에서 비동기로 끝나므로 갱신을 보조기술에도 알린다 */}
          <p aria-live="polite" className="mt-1 text-sm text-muted-foreground">
            {describeDocument(document, canManage)}
          </p>
          {isDownloadError && (
            <p role="alert" className="mt-1 text-xs text-destructive">
              분석 PDF를 받지 못했어요. 잠시 후 다시 시도해 주세요
            </p>
          )}
        </div>
      </div>

      <div className="shrink-0">
        {document?.downloadable ? (
          <Button
            variant="outline"
            size="sm"
            disabled={isDownloading}
            onClick={() =>
              download({
                propertyId,
                documentId: document.documentId,
                fallbackFileName: `${propertyTitle}_${documentType}_분석.pdf`,
              })
            }
          >
            <Download />
            {isDownloading ? "받는 중..." : "분석 PDF"}
          </Button>
        ) : (
          !document &&
          canManage && (
            <Button asChild variant="outline" size="sm">
              <Link to={`/properties/${propertyId}/edit`}>서류 등록</Link>
            </Button>
          )
        )}
      </div>
    </div>
  );
}

interface PropertyDocumentSectionProps {
  propertyId: number;
  propertyTitle: string;
  canManage: boolean;
  isLoggedIn: boolean;
}

// 매물에 등록된 서류와 AI 분석 결과 — 등기부등본·건축물대장 두 슬롯을 항상 보여줘
// 어떤 서류가 빠졌는지도 함께 드러낸다
function PropertyDocumentSection({
  propertyId,
  propertyTitle,
  canManage,
  isLoggedIn,
}: PropertyDocumentSectionProps) {
  // 서류 조회는 인증이 필요하다 — 비로그인 상태에서는 401 대신 로그인을 안내한다
  const {
    data: documents,
    isPending,
    isError,
    refetch,
  } = usePropertyDocuments(propertyId, isLoggedIn);

  if (!isLoggedIn) {
    return (
      <SectionCard>
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-8 text-center">
          <Lock aria-hidden className="size-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            로그인하면 이 매물의 서류와 AI 분석 결과를 확인할 수 있어요
          </p>
          <Button asChild variant="outline" size="sm">
            <Link to="/login">로그인</Link>
          </Button>
        </div>
      </SectionCard>
    );
  }

  if (isPending) {
    return (
      <SectionCard>
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </SectionCard>
    );
  }

  if (isError) {
    return (
      <SectionCard>
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            서류 정보를 불러오지 못했습니다
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            다시 시도
          </Button>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard>
      {DOCUMENT_TYPES.map((documentType) => (
        <DocumentSlot
          key={documentType}
          documentType={documentType}
          document={documents.find(
            (document) => document.documentType === documentType,
          )}
          propertyId={propertyId}
          propertyTitle={propertyTitle}
          canManage={canManage}
        />
      ))}
    </SectionCard>
  );
}

export default PropertyDocumentSection;
