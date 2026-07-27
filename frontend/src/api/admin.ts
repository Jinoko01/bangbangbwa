import { BROKER_APPLICATIONS } from "@/data/brokerApplications";
import type { BrokerApplication } from "@/types";

// ADMIN-01~03 관리자 심사 API 스텁.
// 백엔드 완성 후 이 파일만 교체하면 됨 (client.ts fetcher 사용 예정).

function today() {
  return new Date().toISOString().slice(0, 10);
}

// TODO: ADMIN-01 신청 목록 조회 API 연동
export async function fetchBrokerApplications(): Promise<BrokerApplication[]> {
  return BROKER_APPLICATIONS.map((application) => ({ ...application }));
}

// TODO: ADMIN-03 승인 API 연동 — 승인 시 신청자 계정이 중개사로 전환됨
export async function approveBrokerApplication(
  application: BrokerApplication,
): Promise<BrokerApplication> {
  return { ...application, status: "승인 완료", processedAt: today() };
}

// TODO: ADMIN-03 반려 API 연동 — 사유는 신청자 마이페이지에 노출됨
export async function rejectBrokerApplication(
  application: BrokerApplication,
  reason: string,
): Promise<BrokerApplication> {
  return {
    ...application,
    status: "반려",
    processedAt: today(),
    rejectReason: reason,
  };
}
