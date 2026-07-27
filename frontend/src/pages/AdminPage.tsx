import { useActionState, useEffect, useState, useTransition } from "react";
import {
  CheckCircle2,
  Download,
  ExternalLink,
  FileSearch,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import * as adminApi from "@/api/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { isValidRegistrationNumber } from "@/lib/brokerRegistration";
import { downloadFileFromUrl } from "@/lib/file";
import { cn } from "@/lib/utils";
import type {
  BrokerApplication,
  BrokerApplicationDocument,
  BrokerApplicationStatus,
} from "@/types";

const STATUS_TABS: BrokerApplicationStatus[] = ["심사 중", "승인 완료", "반려"];

// TODO: 백엔드 연동 시 V-World 부동산중개업 조회 API로 자동 검증 예정
const REGISTRY_LOOKUP_URL = "https://www.vworld.kr";

function ApplicationStatusBadge({ status }: Pick<BrokerApplication, "status">) {
  const tone =
    status === "승인 완료"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "반려"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-amber-200 bg-amber-50 text-amber-700";
  const dot =
    status === "승인 완료"
      ? "bg-emerald-500"
      : status === "반려"
        ? "bg-red-500"
        : "bg-amber-500";

  return (
    <Badge
      variant="outline"
      className={cn("gap-1 px-2 py-0.5 font-medium", tone)}
    >
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", dot)} />
      {status}
    </Badge>
  );
}

function RejectDialog({
  application,
  open,
  onOpenChange,
  onRejected,
}: {
  application: BrokerApplication;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRejected: (application: BrokerApplication) => void;
}) {
  const [error, submitAction, isPending] = useActionState(
    async (_prev: string | null, formData: FormData) => {
      const reason = String(formData.get("reason") ?? "").trim();
      if (!reason) {
        return "반려 사유를 입력해주세요";
      }
      try {
        const next = await adminApi.rejectBrokerApplication(
          application,
          reason,
        );
        onRejected(next);
        onOpenChange(false);
        return null;
      } catch {
        return "반려 처리에 실패했습니다. 잠시 후 다시 시도해주세요";
      }
    },
    null,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>인증 신청 반려</DialogTitle>
          <DialogDescription>
            {application.nickname}({application.applicantName})님의 신청을
            반려합니다. 사유는 신청자 마이페이지에 그대로 표시됩니다.
          </DialogDescription>
        </DialogHeader>
        <form action={submitAction} className="flex flex-col gap-4">
          <Textarea
            name="reason"
            placeholder="예) 등록번호가 조회 결과와 일치하지 않습니다"
            rows={4}
            maxLength={200}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              취소
            </Button>
            <Button type="submit" variant="destructive" disabled={isPending}>
              반려하기
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// 서류 썸네일 클릭 시 원본 크기로 확인하고 내려받는 모달
function DocumentDialog({
  document,
  downloading,
  onDownload,
  onClose,
}: {
  document: BrokerApplicationDocument | null;
  downloading: boolean;
  onDownload: (document: BrokerApplicationDocument) => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={document !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="flex flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{document?.type}</DialogTitle>
          <DialogDescription>{document?.fileName}</DialogDescription>
        </DialogHeader>
        {document && (
          <>
            <img
              src={document.previewUrl}
              alt={`${document.type} 미리보기`}
              className="max-h-[70svh] w-full rounded-lg object-contain"
            />
            <Button
              variant="outline"
              className="self-end"
              disabled={downloading}
              onClick={() => onDownload(document)}
            >
              <Download /> {downloading ? "다운로드 중..." : "다운로드"}
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AdminSkeleton() {
  return (
    <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
      <Card className="gap-3 py-4">
        <CardContent className="space-y-2 px-4">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </CardContent>
      </Card>
      <Card className="gap-3 py-4">
        <CardContent className="space-y-4 px-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </CardContent>
      </Card>
    </div>
  );
}

// PAGE-ADMIN 중개사 인증 심사 — 신청 목록 조회(ADMIN-01), 상세 검토(ADMIN-02), 승인/반려(ADMIN-03)
function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [applications, setApplications] = useState<BrokerApplication[]>([]);
  const [activeTab, setActiveTab] =
    useState<BrokerApplicationStatus>("심사 중");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [previewDocument, setPreviewDocument] =
    useState<BrokerApplicationDocument | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isApproving, startApprove] = useTransition();
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // ADMIN-02 서류 원본 내려받기 — 파일명 그대로 저장
  const handleDownload = async (target: BrokerApplicationDocument) => {
    setDownloadError(null);
    setDownloadingFile(target.fileName);
    try {
      await downloadFileFromUrl(target.previewUrl, target.fileName);
    } catch {
      setDownloadError(
        "서류 다운로드에 실패했습니다. 잠시 후 다시 시도해주세요",
      );
    } finally {
      setDownloadingFile(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    adminApi
      .fetchBrokerApplications()
      .then((list) => {
        if (!cancelled) {
          setApplications(list);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError("신청 목록을 불러오지 못했습니다. 새로고침해 주세요.");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = applications.filter(
    (application) => application.status === activeTab,
  );
  const selected =
    filtered.find((application) => application.id === selectedId) ??
    filtered[0];
  const pendingCount = applications.filter(
    (application) => application.status === "심사 중",
  ).length;
  // 같은 등록번호로 이미 승인된 건이 있으면 중복 신청 경고
  const isDuplicate =
    selected !== undefined &&
    applications.some(
      (application) =>
        application.id !== selected.id &&
        application.status === "승인 완료" &&
        application.registrationNumber === selected.registrationNumber,
    );
  const isFormatValid =
    selected !== undefined &&
    isValidRegistrationNumber(selected.registrationNumber);

  const replaceApplication = (next: BrokerApplication) =>
    setApplications((prev) =>
      prev.map((application) =>
        application.id === next.id ? next : application,
      ),
    );

  const handleApprove = () => {
    if (!selected) {
      return;
    }
    setActionError(null);
    startApprove(async () => {
      try {
        replaceApplication(await adminApi.approveBrokerApplication(selected));
      } catch {
        setActionError("승인 처리에 실패했습니다. 잠시 후 다시 시도해주세요");
      }
    });
  };

  return (
    <main className="min-h-[calc(100svh-3.5rem)] bg-white">
      <section className="border-b bg-slate-50/70">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-xl font-semibold">중개사 인증 심사</h1>
            <p className="text-xs text-muted-foreground">
              중개업등록번호와 증빙 서류를 확인하고 승인 여부를 결정하세요
            </p>
          </div>
          <Badge variant="secondary">
            <ShieldCheck /> 심사 대기 {pendingCount}건
          </Badge>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 pt-4">
        <div className="inline-flex rounded-xl bg-slate-100 p-1">
          {STATUS_TABS.map((tab) => {
            const count = applications.filter(
              (application) => application.status === tab,
            ).length;
            return (
              <button
                key={tab}
                type="button"
                className={cn(
                  "rounded-lg px-5 py-2 text-sm transition-colors",
                  activeTab === tab
                    ? "bg-white font-semibold text-primary shadow-sm"
                    : "text-muted-foreground",
                )}
                onClick={() => {
                  setActiveTab(tab);
                  setSelectedId(null);
                  setActionError(null);
                }}
              >
                {tab} {count}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-5">
        {loading ? (
          <AdminSkeleton />
        ) : loadError ? (
          <p className="py-20 text-center text-sm text-destructive">
            {loadError}
          </p>
        ) : !selected ? (
          <div className="py-20 text-center">
            <FileSearch className="mx-auto size-10 text-muted-foreground" />
            <h2 className="mt-4 font-semibold">
              {activeTab} 상태의 신청이 없습니다
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              새 신청이 접수되면 이곳에 표시됩니다.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
            <Card className="gap-3 self-start py-4">
              <CardHeader className="flex-row items-center justify-between px-4">
                <CardTitle className="text-base">신청 목록</CardTitle>
                <Badge variant="secondary">{filtered.length}건</Badge>
              </CardHeader>
              <CardContent className="space-y-2 px-4">
                {filtered.map((application) => (
                  <button
                    key={application.id}
                    type="button"
                    className={cn(
                      "w-full rounded-xl border p-3 text-left transition-colors",
                      application.id === selected.id
                        ? "border-primary bg-primary/[0.04]"
                        : "bg-slate-50 hover:bg-slate-100",
                    )}
                    onClick={() => setSelectedId(application.id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <strong className="truncate text-sm">
                        {application.nickname}
                      </strong>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {application.applicantName}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-medium">
                      {application.registrationNumber}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {application.appliedAt} 신청
                      </span>
                      {!isValidRegistrationNumber(
                        application.registrationNumber,
                      ) && (
                        <span className="text-xs font-medium text-destructive">
                          형식 오류
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card className="gap-3 self-start py-4">
              <CardHeader className="flex-row items-start justify-between px-4">
                <div>
                  <CardTitle className="text-base">신청 상세</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    신청 정보와 서류를 검토하세요
                  </p>
                </div>
                <ApplicationStatusBadge status={selected.status} />
              </CardHeader>
              <CardContent className="space-y-4 px-4">
                <div className="grid grid-cols-2 overflow-hidden rounded-xl border text-sm">
                  <div className="border-b border-r bg-slate-50 p-3 text-muted-foreground">
                    신청자
                  </div>
                  <div className="border-b p-3 font-semibold">
                    {selected.nickname} · {selected.applicantName}
                  </div>
                  <div className="border-b border-r bg-slate-50 p-3 text-muted-foreground">
                    이메일
                  </div>
                  <div className="border-b p-3">{selected.email}</div>
                  <div className="border-b border-r bg-slate-50 p-3 text-muted-foreground">
                    연락처
                  </div>
                  <div className="border-b p-3">{selected.phone}</div>
                  <div className="border-r bg-slate-50 p-3 text-muted-foreground">
                    신청일
                  </div>
                  <div className="p-3">{selected.appliedAt}</div>
                </div>

                <div className="rounded-xl border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        중개업등록번호
                      </p>
                      <p className="mt-1 text-lg font-semibold tracking-wide">
                        {selected.registrationNumber}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "gap-1 font-medium",
                        isFormatValid
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-red-200 bg-red-50 text-red-700",
                      )}
                    >
                      {isFormatValid ? <CheckCircle2 /> : <XCircle />}
                      {isFormatValid ? "형식 확인" : "형식 오류"}
                    </Badge>
                  </div>
                  {!isFormatValid && (
                    <p className="mt-2 text-xs text-destructive">
                      시군구코드(5자리)-연도(4자리)-일련번호(5자리) 형식이
                      아닙니다. 예) 11680-2026-00123
                    </p>
                  )}
                  {isDuplicate && (
                    <p className="mt-2 text-xs text-destructive">
                      이미 같은 등록번호로 승인된 계정이 있습니다. 중복 신청
                      여부를 확인해 주세요.
                    </p>
                  )}
                  <Button asChild variant="outline" size="sm" className="mt-3">
                    <a
                      href={REGISTRY_LOOKUP_URL}
                      target="_blank"
                      rel="noreferrer"
                    >
                      국가공간정보포털에서 등록번호 조회
                      <ExternalLink />
                    </a>
                  </Button>
                </div>

                <div>
                  <p className="text-sm font-semibold">
                    증빙 서류 {selected.documents.length}건
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {selected.documents.map((document) => (
                      <div
                        key={document.fileName}
                        className="rounded-xl border p-2"
                      >
                        <button
                          type="button"
                          className="block w-full rounded-lg text-left transition-opacity hover:opacity-80"
                          onClick={() => setPreviewDocument(document)}
                        >
                          <img
                            src={document.previewUrl}
                            alt={`${document.type} 썸네일`}
                            className="h-24 w-full rounded-lg object-cover"
                          />
                          <p className="mt-2 truncate text-xs font-medium">
                            {document.type}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {document.fileName}
                          </p>
                        </button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2 w-full"
                          disabled={downloadingFile === document.fileName}
                          onClick={() => handleDownload(document)}
                        >
                          <Download />
                          {downloadingFile === document.fileName
                            ? "다운로드 중..."
                            : "다운로드"}
                        </Button>
                      </div>
                    ))}
                  </div>
                  {downloadError && (
                    <p className="mt-2 text-xs text-destructive">
                      {downloadError}
                    </p>
                  )}
                </div>

                {selected.status === "심사 중" ? (
                  <div className="border-t pt-4">
                    {actionError && (
                      <p className="mb-3 text-sm text-destructive">
                        {actionError}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        className="flex-1"
                        disabled={isApproving}
                        onClick={handleApprove}
                      >
                        <CheckCircle2 /> 승인
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1"
                        disabled={isApproving}
                        onClick={() => setRejectOpen(true)}
                      >
                        <XCircle /> 반려
                      </Button>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      승인하면 신청자 계정이 중개사로 전환됩니다.
                    </p>
                  </div>
                ) : (
                  <div
                    className={cn(
                      "rounded-xl border p-4 text-sm",
                      selected.status === "승인 완료"
                        ? "border-emerald-200 bg-emerald-50/60"
                        : "border-red-200 bg-red-50/60",
                    )}
                  >
                    <p className="font-semibold">
                      {selected.processedAt}에{" "}
                      {selected.status === "승인 완료" ? "승인" : "반려"}
                      처리된 신청입니다
                    </p>
                    {selected.rejectReason && (
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        반려 사유: {selected.rejectReason}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {selected && (
        <RejectDialog
          key={selected.id}
          application={selected}
          open={rejectOpen}
          onOpenChange={setRejectOpen}
          onRejected={replaceApplication}
        />
      )}
      <DocumentDialog
        document={previewDocument}
        downloading={
          previewDocument !== null &&
          downloadingFile === previewDocument.fileName
        }
        onDownload={handleDownload}
        onClose={() => setPreviewDocument(null)}
      />
    </main>
  );
}

export default AdminPage;
