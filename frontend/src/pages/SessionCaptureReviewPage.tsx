import { useState } from "react";
import {
  Check,
  FileText,
  ImageOff,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { isApiError } from "@/api/error";
import type { StoredSessionCapture } from "@/api/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useCreateReport } from "@/hooks/queries/reportQueries";
import {
  useDeleteSessionCaptures,
  useStoredSessionCaptures,
} from "@/hooks/queries/sessionQueries";
import { cn } from "@/lib/utils";

function formatCaptureTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function CaptureCard({
  capture,
  selected,
  onToggle,
}: {
  capture: StoredSessionCapture;
  selected: boolean;
  onToggle: () => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${formatCaptureTime(capture.capturedAt)} 캡처 사진 ${selected ? "삭제 선택 해제" : "삭제 선택"}`}
      onClick={onToggle}
      className={cn(
        "group overflow-hidden rounded-xl border bg-background text-left shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "border-destructive ring-2 ring-destructive/20"
          : "hover:border-primary/40",
      )}
    >
      <div className="relative aspect-video bg-slate-900">
        {imageFailed ? (
          <div className="flex size-full flex-col items-center justify-center gap-2 text-sm text-slate-400">
            <ImageOff className="size-6" /> 이미지를 표시할 수 없습니다
          </div>
        ) : (
          <img
            src={capture.imageUrl}
            alt=""
            className="size-full object-contain"
            onError={() => setImageFailed(true)}
          />
        )}
        <span
          className={cn(
            "absolute top-3 right-3 grid size-8 place-items-center rounded-full border-2 bg-white text-transparent shadow-sm",
            selected && "border-destructive bg-destructive text-white",
          )}
          aria-hidden="true"
        >
          <Check className="size-4" />
        </span>
      </div>
      <div className="space-y-1.5 p-4">
        <p className="text-xs text-muted-foreground">
          {formatCaptureTime(capture.capturedAt)}
        </p>
        <p className="text-sm font-medium text-foreground">
          삭제하지 않으면 리포트에 포함됩니다
        </p>
      </div>
    </button>
  );
}

function SessionCaptureReviewPage() {
  const { sessionId: sessionIdParam } = useParams();
  const navigate = useNavigate();
  const parsedSessionId = Number(sessionIdParam);
  const sessionId = Number.isInteger(parsedSessionId)
    ? parsedSessionId
    : undefined;
  const {
    data: captures = [],
    isPending,
    isError,
    error,
    refetch,
  } = useStoredSessionCaptures(sessionId);
  const deleteCaptures = useDeleteSessionCaptures(sessionId ?? -1);
  const createReport = useCreateReport();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const toggleCapture = (captureId: number) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(captureId)) {
        next.delete(captureId);
      } else {
        next.add(captureId);
      }
      return next;
    });
  };

  const handleDelete = async () => {
    if (selectedIds.size === 0) {
      return;
    }
    setActionError(null);
    try {
      await deleteCaptures.mutateAsync([...selectedIds]);
      setSelectedIds(new Set());
      setDeleteOpen(false);
    } catch (deleteError) {
      setActionError(
        isApiError(deleteError)
          ? deleteError.message
          : "선택한 사진을 삭제하지 못했습니다.",
      );
      setDeleteOpen(false);
    }
  };

  const handleCreateReport = async () => {
    if (sessionId === undefined) {
      return;
    }
    setActionError(null);
    try {
      await createReport.mutateAsync(sessionId);
      navigate("/mypage?section=reports", {
        replace: true,
        state: { reportSaved: true },
      });
    } catch (reportError) {
      setActionError(
        isApiError(reportError)
          ? reportError.message
          : reportError instanceof Error
            ? reportError.message
            : "리포트를 생성하지 못했습니다.",
      );
    }
  };

  if (sessionId === undefined) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12">
        <p className="font-medium">올바르지 않은 세션입니다.</p>
        <Button className="mt-4" onClick={() => navigate("/reservations")}>
          예약 목록으로
        </Button>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100svh-3.5rem)] bg-slate-50/60 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">세션 종료 완료</p>
            <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
              캡처 사진을 확인해 주세요
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              세입자가 촬영한 사진과 저장된 검출 사진을 확인하고, 불필요한
              사진을 삭제한 뒤 리포트를 생성하세요.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="destructive"
              disabled={selectedIds.size === 0 || deleteCaptures.isPending}
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 /> 선택 삭제 ({selectedIds.size})
            </Button>
            <Button
              disabled={deleteCaptures.isPending || createReport.isPending}
              onClick={() => void handleCreateReport()}
            >
              {createReport.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <FileText />
              )}
              {createReport.isPending ? "리포트 생성 중..." : "리포트 생성"}
            </Button>
          </div>
        </header>

        {actionError && (
          <p
            role="alert"
            className="mt-5 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            {actionError}
          </p>
        )}

        {isPending ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Skeleton className="aspect-video rounded-xl" />
            <Skeleton className="aspect-video rounded-xl" />
          </div>
        ) : isError ? (
          <Card className="mt-6">
            <CardContent className="flex flex-col items-center py-12 text-center">
              <ImageOff className="size-8 text-muted-foreground" />
              <p className="mt-3 font-medium">
                캡처 사진을 불러오지 못했습니다.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {isApiError(error)
                  ? error.message
                  : "잠시 후 다시 시도해 주세요."}
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => refetch()}
              >
                <RefreshCw /> 다시 시도
              </Button>
            </CardContent>
          </Card>
        ) : captures.length === 0 ? (
          <Card className="mt-6">
            <CardContent className="flex flex-col items-center py-12 text-center">
              <Check className="size-8 text-emerald-600" />
              <p className="mt-3 font-medium">저장된 캡처 사진이 없습니다.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                바로 리포트를 생성할 수 있습니다.
              </p>
            </CardContent>
          </Card>
        ) : (
          <section className="mt-6" aria-label="세션 캡처 사진">
            <div className="grid gap-4 sm:grid-cols-2">
              {captures.map((capture) => (
                <CaptureCard
                  key={capture.captureId}
                  capture={capture}
                  selected={selectedIds.has(capture.captureId)}
                  onToggle={() => toggleCapture(capture.captureId)}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>선택한 사진을 삭제할까요?</DialogTitle>
            <DialogDescription>
              선택한 {selectedIds.size}장의 사진과 연결된 하자 정보가 함께
              삭제되며 복구할 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              취소
            </Button>
            <Button
              variant="destructive"
              disabled={deleteCaptures.isPending}
              onClick={() => void handleDelete()}
            >
              {deleteCaptures.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Trash2 />
              )}
              {deleteCaptures.isPending ? "삭제 중..." : "삭제"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

export default SessionCaptureReviewPage;
