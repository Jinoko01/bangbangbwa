import type { ChangeEvent, ReactNode } from "react";
import { FileText, RotateCcw, X } from "lucide-react";

import DocumentStatusBadge from "@/components/DocumentStatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PROPERTY_LIMITS } from "@/lib/propertyValidation";
import {
  DOCUMENT_TYPES,
  type DocumentType,
  type PropertyDocument,
} from "@/types";

// 슬롯에 담아둔 변경 — 저장을 눌러야 서버에 반영된다 (사진과 같은 규칙)
export interface DocumentDraft {
  file?: File;
  removed?: boolean;
}

export type DocumentDrafts = Partial<Record<DocumentType, DocumentDraft>>;

function SlotShell({
  documentType,
  badge,
  description,
  actions,
}: {
  documentType: DocumentType;
  badge?: ReactNode;
  description: ReactNode;
  actions: ReactNode;
}) {
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
            {badge}
          </div>
          <div className="mt-1 text-xs font-normal break-all text-muted-foreground">
            {description}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">{actions}</div>
    </div>
  );
}

function FileSelectButton({
  label,
  documentType,
  onSelect,
}: {
  label: string;
  documentType: DocumentType;
  onSelect: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <Button
      asChild
      variant="outline"
      size="sm"
      className="cursor-pointer has-[:focus-visible]:border-ring has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50"
    >
      <label>
        {label}
        <span className="sr-only">{documentType}</span>
        <input
          type="file"
          accept="application/pdf"
          className="sr-only"
          onChange={onSelect}
        />
      </label>
    </Button>
  );
}

interface PropertyDocumentFieldsProps {
  documents: PropertyDocument[];
  drafts: DocumentDrafts;
  isLoading?: boolean;
  error?: string | null;
  onChange: (documentType: DocumentType, draft: DocumentDraft | null) => void;
}

// PROP-07·08 매물 서류 — 등기부등본·건축물대장 두 슬롯을 고정으로 두고
// 각 슬롯은 비어 있거나 서류 1건을 갖는다. 변경은 저장 시 한 번에 반영된다
function PropertyDocumentFields({
  documents,
  drafts,
  isLoading,
  error,
  onChange,
}: PropertyDocumentFieldsProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 sm:col-span-2">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:col-span-2">
      {DOCUMENT_TYPES.map((documentType) => {
        const existing = documents.find(
          (document) => document.documentType === documentType,
        );
        const draft = drafts[documentType];

        const handleSelect = (event: ChangeEvent<HTMLInputElement>) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) {
            onChange(documentType, { file });
          }
        };

        if (draft?.file) {
          return (
            <SlotShell
              key={documentType}
              documentType={documentType}
              description={
                <>
                  {draft.file.name}
                  <span className="mt-0.5 block">
                    {existing
                      ? "저장하면 기존 서류를 교체하고 다시 분석해요"
                      : "저장하면 업로드하고 AI 분석을 시작해요"}
                  </span>
                </>
              }
              actions={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onChange(documentType, null)}
                >
                  <X />
                  선택 취소
                </Button>
              }
            />
          );
        }

        if (draft?.removed && existing) {
          return (
            <SlotShell
              key={documentType}
              documentType={documentType}
              description="저장하면 등록된 서류와 분석 결과가 삭제돼요"
              actions={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onChange(documentType, null)}
                >
                  <RotateCcw />
                  되돌리기
                </Button>
              }
            />
          );
        }

        if (existing) {
          return (
            <SlotShell
              key={documentType}
              documentType={documentType}
              badge={
                <DocumentStatusBadge
                  status={existing.status}
                  riskLevel={existing.riskLevel}
                />
              }
              description={
                existing.summary ??
                (existing.status === "PROCESSING"
                  ? "AI가 서류를 분석하고 있어요"
                  : "분석 요약이 아직 없어요")
              }
              actions={
                <>
                  <FileSelectButton
                    label="교체"
                    documentType={documentType}
                    onSelect={handleSelect}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`${documentType} 삭제`}
                    onClick={() => onChange(documentType, { removed: true })}
                  >
                    <X />
                  </Button>
                </>
              }
            />
          );
        }

        return (
          <SlotShell
            key={documentType}
            documentType={documentType}
            description="아직 등록하지 않았어요"
            actions={
              <FileSelectButton
                label="PDF 선택"
                documentType={documentType}
                onSelect={handleSelect}
              />
            }
          />
        );
      })}

      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : (
        <p className="text-xs font-normal text-muted-foreground">
          등기부등본·건축물대장을 올리면 AI가 권리관계를 분석해 매물 상세에
          위험도와 요약을 보여줍니다 (PDF, {PROPERTY_LIMITS.documentMaxSizeMb}MB
          이하)
        </p>
      )}
    </div>
  );
}

export default PropertyDocumentFields;
