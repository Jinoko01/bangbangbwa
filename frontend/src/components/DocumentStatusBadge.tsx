import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DocumentStatus, RiskLevel } from "@/types";

const RISK_TONE: Record<RiskLevel, { badge: string; dot: string }> = {
  안전: {
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
  },
  주의: {
    badge: "border-amber-200 bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
  },
  위험: {
    badge: "border-red-200 bg-red-50 text-red-700",
    dot: "bg-red-500",
  },
};

// 위험도가 아직 없을 때 대신 보여줄 상태 — 분석 완료인데 위험도가 비어 오는 경우도 덮는다
const STATUS_TONE: Record<
  DocumentStatus,
  { label: string; badge: string; dot: string }
> = {
  PROCESSING: {
    label: "분석 중",
    badge: "border-border bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
  },
  COMPLETED: {
    label: "분석 완료",
    badge: "border-border bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
  },
  FAILED: {
    label: "분석 실패",
    badge: "border-red-200 bg-red-50 text-red-700",
    dot: "bg-red-500",
  },
};

// 분석이 끝난 서류는 위험도가, 그 전에는 진행 상태가 사용자에게 필요한 정보다.
// 색만으로 뜻이 전달되지 않도록 라벨을 항상 함께 보여준다
function DocumentStatusBadge({
  status,
  riskLevel,
  className,
}: {
  status: DocumentStatus;
  riskLevel?: RiskLevel;
  className?: string;
}) {
  const tone =
    status === "COMPLETED" && riskLevel
      ? { ...RISK_TONE[riskLevel], label: riskLevel }
      : STATUS_TONE[status];

  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 px-2 py-0.5 font-medium", tone.badge, className)}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", tone.dot)} />
      {tone.label}
    </Badge>
  );
}

export default DocumentStatusBadge;
