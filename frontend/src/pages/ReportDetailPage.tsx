import {
  ArrowLeft,
  Camera,
  Check,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Clock3,
  Download,
  MapPin,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import type { ReportCapture, ReportDefect } from "@/api/report";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useDownloadReport,
  useReportDetail,
} from "@/hooks/queries/reportQueries";
import { usePropertyDetail } from "@/hooks/queries/propertyQueries";
import { formatDateTime } from "@/lib/format";
import type { ChecklistItem } from "@/types";

type ChecklistDisplayStatus = "COMPLETED" | "PENDING";

interface ChecklistStatusStyle {
  label: string;
  description: string;
  icon: LucideIcon;
  iconClassName: string;
  badgeClassName: string;
  groupClassName: string;
}

const CHECKLIST_STATUS: Record<ChecklistDisplayStatus, ChecklistStatusStyle> = {
  COMPLETED: {
    label: "확인 완료",
    description: "현장에서 확인을 마친 항목",
    icon: CheckCircle2,
    iconClassName: "text-emerald-600",
    badgeClassName:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
    groupClassName: "border-emerald-200/80 dark:border-emerald-900",
  },
  PENDING: {
    label: "점검 전",
    description: "아직 현장에서 점검하지 않은 항목",
    icon: Circle,
    iconClassName: "text-slate-400",
    badgeClassName:
      "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
    groupClassName: "border-slate-200 dark:border-slate-800",
  },
};

const CHECKLIST_ORDER: ChecklistDisplayStatus[] = ["PENDING", "COMPLETED"];

function ChecklistGroup({
  status,
  items,
}: {
  status: ChecklistDisplayStatus;
  items: ChecklistItem[];
}) {
  if (items.length === 0) {
    return null;
  }

  const style = CHECKLIST_STATUS[status];
  const StatusIcon = style.icon;

  return (
    <section
      className={`overflow-hidden rounded-xl border ${style.groupClassName}`}
    >
      <header className="flex flex-col gap-2 border-b bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          {status === "PENDING" ? (
            <span className="text-lg leading-none" aria-hidden="true">
              ⚠️
            </span>
          ) : (
            <StatusIcon className={`size-5 shrink-0 ${style.iconClassName}`} />
          )}
          <div>
            <h3 className="text-sm font-semibold">{style.label}</h3>
            <p className="text-xs text-muted-foreground">{style.description}</p>
          </div>
        </div>
        <span
          className={`w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${style.badgeClassName}`}
        >
          {items.length}개
        </span>
      </header>

      <ul className="divide-y">
        {items.map((item) => (
          <li
            key={item.itemId}
            className="flex gap-3 bg-background px-4 py-4 transition-colors hover:bg-muted/20"
          >
            {status === "COMPLETED" ? (
              <CheckCircle2
                className="mt-0.5 size-6 shrink-0 fill-emerald-600 text-white"
                aria-hidden="true"
              />
            ) : (
              <Circle
                className="mt-0.5 size-6 shrink-0 text-slate-300"
                aria-hidden="true"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-6">{item.content}</p>
              {item.memo && (
                <p className="mt-2 rounded-lg bg-muted/60 px-3 py-2 text-sm leading-6 text-muted-foreground">
                  <span className="mr-2 font-medium text-foreground">메모</span>
                  {item.memo}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

const EMOJI_SHORTCODES: Record<string, string> = {
  ":house:": "🏠",
  ":warning:": "⚠️",
  ":white_check_mark:": "✅",
  ":memo:": "📝",
  ":bulb:": "💡",
  ":mag:": "🔍",
  ":sparkles:": "✨",
};

function cleanSummaryText(value: string) {
  return Object.entries(EMOJI_SHORTCODES)
    .reduce(
      (text, [shortcode, emoji]) => text.replaceAll(shortcode, emoji),
      value,
    )
    .replace(/\*\*|__|`/g, "")
    .replace(/^>+\s*/, "")
    .replace(/[<>]+$/g, "")
    .trim();
}

function normalizeSummary(summary: string) {
  return summary
    .replaceAll("\\n", "\n")
    .replace(/\s*(#{1,3})\s*/g, "\n$1 ")
    .replace(/\s+([-*]\s+(?:\[[ xX]\]\s+)?)/g, "\n$1")
    .replace(/\s*---+\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function ReportSummaryDocument({ summary }: { summary: string }) {
  const lines = normalizeSummary(summary).split("\n");

  return (
    <div className="mt-5 space-y-3 text-sm leading-7 text-foreground/90">
      {lines.map((rawLine, index) => {
        const line = rawLine.trim();
        const heading = /^(#{1,3})\s*(.+)$/.exec(line);
        const checkbox = /^[-*]\s+\[([ xX])\]\s+(.+)$/.exec(line);
        const bullet = /^[-*]\s+(.+)$/.exec(line);

        if (!line) {
          return <div key={index} className="h-1" aria-hidden="true" />;
        }
        if (heading) {
          const level = heading[1].length;
          return (
            <h3
              key={index}
              className={
                level === 1
                  ? "flex items-center gap-2 pt-3 text-2xl font-bold tracking-tight"
                  : level === 2
                    ? "flex items-center gap-2 pt-3 text-xl font-bold tracking-tight"
                    : "pt-2 text-lg font-semibold"
              }
            >
              {level <= 2 && (
                <Sparkles
                  className="size-5 shrink-0 text-primary"
                  aria-hidden="true"
                />
              )}
              {cleanSummaryText(heading[2])}
            </h3>
          );
        }
        if (checkbox) {
          const checked = checkbox[1].toLowerCase() === "x";
          return (
            <div
              key={index}
              className="flex items-start gap-3 rounded-xl bg-muted/40 px-3 py-2.5"
            >
              <span
                className={`mt-1 flex size-5 shrink-0 items-center justify-center rounded-md border ${
                  checked
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-slate-300 bg-background"
                }`}
                aria-hidden="true"
              >
                {checked && <Check className="size-3.5 stroke-[3]" />}
              </span>
              <span>{cleanSummaryText(checkbox[2])}</span>
            </div>
          );
        }
        if (bullet) {
          return (
            <p key={index} className="flex gap-3 pl-1">
              <span className="text-primary" aria-hidden="true">
                •
              </span>
              <span>{cleanSummaryText(bullet[1])}</span>
            </p>
          );
        }
        return (
          <p key={index} className="break-words whitespace-pre-wrap">
            {cleanSummaryText(line)}
          </p>
        );
      })}
    </div>
  );
}

const DEFECT_TYPE_LABEL: Record<ReportDefect["type"], string> = {
  MOLD: "곰팡이",
  WALLPAPER_DAMAGE: "벽지 손상",
};

const CAPTURE_FRAME_RATIO = 16 / 9;

interface DefectBox {
  defectId: number;
  label: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

function toDefectBox(defect: ReportDefect): DefectBox | null {
  const { bboxXCenter, bboxYCenter, bboxWidth, bboxHeight } = defect;
  if (
    bboxXCenter === undefined ||
    bboxYCenter === undefined ||
    bboxWidth === undefined ||
    bboxHeight === undefined
  ) {
    return null;
  }

  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  const left = clamp(bboxXCenter - bboxWidth / 2);
  const top = clamp(bboxYCenter - bboxHeight / 2);

  return {
    defectId: defect.defectId,
    label: `${DEFECT_TYPE_LABEL[defect.type]} ${Math.round(defect.confidence * 100)}%`,
    left,
    top,
    width: clamp(bboxXCenter + bboxWidth / 2) - left,
    height: clamp(bboxYCenter + bboxHeight / 2) - top,
  };
}

// bbox 좌표는 원본 이미지 기준 비율이라, object-contain으로 생기는 레터박스
// 여백을 제외한 실제 이미지 영역 위에 오버레이를 얹어야 좌표가 맞는다
function CaptureImageWithDefects({ capture }: { capture: ReportCapture }) {
  const [naturalRatio, setNaturalRatio] = useState<number | null>(null);
  const boxes = capture.defects.map(toDefectBox).filter((box) => box !== null);

  let content = { left: 0, top: 0, width: 1, height: 1 };
  if (naturalRatio !== null && naturalRatio !== CAPTURE_FRAME_RATIO) {
    if (naturalRatio > CAPTURE_FRAME_RATIO) {
      const height = CAPTURE_FRAME_RATIO / naturalRatio;
      content = { left: 0, top: (1 - height) / 2, width: 1, height };
    } else {
      const width = naturalRatio / CAPTURE_FRAME_RATIO;
      content = { left: (1 - width) / 2, top: 0, width, height: 1 };
    }
  }

  return (
    <div className="relative">
      <img
        src={capture.imageUrl}
        alt={`${formatDateTime(capture.capturedAt)} 현장 캡처`}
        className="aspect-video w-full bg-slate-900 object-contain"
        onLoad={(event) => {
          const { naturalWidth, naturalHeight } = event.currentTarget;
          if (naturalWidth && naturalHeight) {
            setNaturalRatio(naturalWidth / naturalHeight);
          }
        }}
      />
      {naturalRatio !== null && boxes.length > 0 && (
        <div
          className="absolute"
          style={{
            left: `${content.left * 100}%`,
            top: `${content.top * 100}%`,
            width: `${content.width * 100}%`,
            height: `${content.height * 100}%`,
          }}
          aria-hidden="true"
        >
          {boxes.map((box) => (
            <div
              key={box.defectId}
              className="absolute rounded-sm border-2 border-amber-400 bg-amber-400/10"
              style={{
                left: `${box.left * 100}%`,
                top: `${box.top * 100}%`,
                width: `${box.width * 100}%`,
                height: `${box.height * 100}%`,
              }}
            >
              <span className="absolute top-0.5 left-0.5 rounded-sm bg-amber-400 px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap text-slate-900">
                {box.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReportDetailPage() {
  const { reportId: reportIdParam } = useParams();
  const navigate = useNavigate();
  const reportId = Number(reportIdParam);
  const validReportId = Number.isInteger(reportId) ? reportId : undefined;
  const {
    data: report,
    isPending,
    isError,
    refetch,
  } = useReportDetail(validReportId);
  const { data: property } = usePropertyDetail(
    report?.propertyId ?? -1,
    report !== undefined,
  );
  const {
    mutate: downloadReport,
    isPending: isDownloading,
    isError: isDownloadError,
  } = useDownloadReport();

  if (isPending) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <Skeleton className="h-72 w-full rounded-2xl" />
        <Skeleton className="mt-6 h-96 w-full rounded-2xl" />
      </main>
    );
  }

  if (isError || !report) {
    return (
      <main className="mx-auto flex max-w-5xl flex-col items-start gap-4 px-4 py-12 sm:px-6">
        <p className="font-medium">리포트를 불러오지 못했어요.</p>
        <p className="text-sm text-muted-foreground">
          네트워크 상태를 확인한 후 다시 시도해 주세요.
        </p>
        <Button variant="outline" onClick={() => refetch()}>
          다시 시도
        </Button>
      </main>
    );
  }

  const items = report.checklist?.items ?? [];
  const statusCounts: Record<ChecklistDisplayStatus, number> = {
    COMPLETED: items.filter((item) => item.status !== "PENDING").length,
    PENDING: items.filter((item) => item.status === "PENDING").length,
  };
  const checkedCount = statusCounts.COMPLETED;
  const progress =
    items.length === 0 ? 0 : Math.round((checkedCount / items.length) * 100);

  return (
    <main className="min-h-[calc(100svh-3.5rem)] bg-slate-50/60 px-4 py-8 dark:bg-slate-950/30 sm:px-6 sm:py-10">
      <article className="mx-auto max-w-5xl">
        <Button
          variant="ghost"
          className="mb-4 -ml-3 min-h-11"
          onClick={() => navigate("/mypage?section=reports")}
        >
          <ArrowLeft className="size-4" /> 리포트 목록
        </Button>

        <header className="overflow-hidden rounded-2xl border bg-background shadow-sm">
          <div className="border-b px-5 py-6 sm:px-8 sm:py-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  {property?.title ?? `매물 #${report.propertyId}`}
                </h1>
                <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="size-4" />
                  {property
                    ? `${property.sigungu} ${property.dong}`
                    : "매물 위치 확인 중"}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end">
                <Button
                  variant="outline"
                  className="min-h-11"
                  disabled={isDownloading}
                  onClick={() =>
                    downloadReport({
                      reportId: report.reportId,
                      fallbackFileName: `${property?.title ?? `매물_${report.propertyId}`}_점검리포트.pdf`,
                    })
                  }
                >
                  <Download className="size-4" />
                  {isDownloading ? "받는 중..." : "PDF 다운로드"}
                </Button>
                {isDownloadError && (
                  <p role="alert" className="text-xs text-destructive">
                    리포트를 받지 못했어요. 잠시 후 다시 시도해 주세요
                  </p>
                )}
              </div>
            </div>
          </div>

          <dl className="grid divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="px-5 py-4 sm:px-6">
              <dt className="text-xs font-medium text-muted-foreground">
                작성일
              </dt>
              <dd className="mt-1.5 flex items-center gap-2 text-sm font-medium">
                <Clock3 className="size-4 text-muted-foreground" />
                {formatDateTime(report.createdAt)}
              </dd>
            </div>
            <div className="px-5 py-4 sm:px-6">
              <dt className="text-xs font-medium text-muted-foreground">
                점검 진행률
              </dt>
              <dd className="mt-1.5 text-sm font-medium">
                {checkedCount}/{items.length}개 확인 · {progress}%
              </dd>
            </div>
            <div className="px-5 py-4 sm:px-6">
              <dt className="text-xs font-medium text-muted-foreground">
                현장 자료
              </dt>
              <dd className="mt-1.5 flex items-center gap-2 text-sm font-medium">
                <Camera className="size-4 text-muted-foreground" /> 사진{" "}
                {report.captures.length}장
              </dd>
            </div>
          </dl>
        </header>

        <div className="mt-6">
          <div className="space-y-6">
            <section className="rounded-2xl border bg-background p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="size-5 text-primary" />
                <h2 className="text-lg font-semibold">점검 요약</h2>
              </div>
              <ReportSummaryDocument
                summary={report.summary || "점검 내용을 정리하고 있습니다."}
              />
            </section>

            <section className="rounded-2xl border bg-background p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">체크리스트</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    미팅에서 작성한 항목을 상태별로 구분했습니다.
                  </p>
                </div>
                <p
                  className="text-sm font-semibold"
                  aria-label={`전체 ${items.length}개 중 ${checkedCount}개 확인`}
                >
                  <span className="text-primary">{checkedCount}개 확인</span>
                  <span className="mx-1.5 text-muted-foreground">/</span>
                  전체 {items.length}개
                </p>
              </div>

              <div
                className="mt-4 h-2 overflow-hidden rounded-full bg-muted"
                aria-hidden="true"
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>

              {items.length === 0 ? (
                <div className="mt-6 rounded-xl border border-dashed px-4 py-10 text-center">
                  <ClipboardCheck className="mx-auto size-6 text-muted-foreground" />
                  <p className="mt-3 text-sm font-medium">
                    작성된 체크리스트가 없습니다.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    미팅에서 작성한 점검 항목이 이곳에 표시됩니다.
                  </p>
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  {CHECKLIST_ORDER.map((status) => (
                    <ChecklistGroup
                      key={status}
                      status={status}
                      items={items.filter((item) =>
                        status === "PENDING"
                          ? item.status === "PENDING"
                          : item.status !== "PENDING",
                      )}
                    />
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl border bg-background p-5 shadow-sm sm:p-6">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <Camera className="size-5 text-primary" /> 현장 사진
                </h2>
                <span className="text-sm text-muted-foreground">
                  {report.captures.length}장
                </span>
              </div>
              {report.captures.length === 0 ? (
                <div className="mt-5 rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                  저장된 현장 사진이 없습니다.
                </div>
              ) : (
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {report.captures.map((capture) => (
                    <figure
                      key={capture.captureId}
                      className="overflow-hidden rounded-xl border bg-muted/20"
                    >
                      <CaptureImageWithDefects capture={capture} />
                      <figcaption className="px-4 py-3">
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(capture.capturedAt)}
                        </p>
                        {capture.defects.length === 0 ? (
                          // AI가 이상을 찾지 못한 사진 — 사용자가 직접 남긴 기록이라
                          // 안전하다는 판정처럼 읽히지 않게 사실만 적는다
                          <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                            <Camera className="size-4" /> 사용자가 캡쳐한
                            사진입니다.
                          </p>
                        ) : (
                          <div className="mt-2 space-y-2">
                            {capture.defects.map((defect) => (
                              <p
                                key={defect.defectId}
                                className="flex gap-2 text-sm text-amber-700 dark:text-amber-300"
                              >
                                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                                <span>
                                  <strong className="font-semibold">
                                    확인 필요
                                  </strong>{" "}
                                  · {defect.description}
                                </span>
                              </p>
                            ))}
                          </div>
                        )}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </article>
    </main>
  );
}

export default ReportDetailPage;
