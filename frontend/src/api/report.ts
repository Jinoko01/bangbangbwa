import { api } from "@/api/client";
import type { Checklist, Page } from "@/types";

const REPORTS_PATH = "/api/reports";

export type ReportStatus = "DETECTED" | "CONFIRMED" | "REJECTED";

export interface ReportStatusResponse {
  reportId: number;
  status: ReportStatus;
}

export interface ReportSummary {
  reportId: number;
  status: ReportStatus;
  propertyId: number;
  propertyTitle: string;
  thumbnailUrl?: string;
  meetingDate: string;
  createdAt: string;
}

export interface ReportDefect {
  defectId: number;
  type: "MOLD" | "WALLPAPER_DAMAGE";
  confidence: number;
  description: string;
  status: ReportStatus;
}

export interface ReportCapture {
  captureId: number;
  imageUrl: string;
  capturedAt: string;
  defects: ReportDefect[];
}

export interface ReportDetail {
  reportId: number;
  status: ReportStatus;
  propertyId: number;
  summary: string;
  createdAt: string;
  checklist: Checklist;
  captures: ReportCapture[];
}

export function createReport(sessionId: number) {
  return api.post<ReportStatusResponse>({
    path: `/api/sessions/${sessionId}/reports`,
  });
}

export function getMyReports(signal?: AbortSignal) {
  return api.get<Page<ReportSummary>>({
    path: `${REPORTS_PATH}/me`,
    config: { params: { page: 0, size: 100, sort: "createdAt,DESC" }, signal },
  });
}

export function getReport(reportId: number, signal?: AbortSignal) {
  return api.get<ReportDetail>({
    path: `${REPORTS_PATH}/${reportId}`,
    config: { signal },
  });
}

export function deleteReport(reportId: number) {
  return api.delete<void>({ path: `${REPORTS_PATH}/${reportId}/delete` });
}

export function getReportStatus(reportId: number) {
  return api.get<ReportStatusResponse>({
    path: `${REPORTS_PATH}/${reportId}/status`,
  });
}

// 인증이 필요한 바이너리 응답이라 envelope를 벗기지 않는 getBlob을 쓴다
export function downloadReport(reportId: number) {
  return api.getBlob({ path: `${REPORTS_PATH}/${reportId}/download` });
}
