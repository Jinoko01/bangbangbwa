import type { Property, User } from "@/types";

// PROP-07~09 매물 등록·수정·삭제 권한 — 인증(승인 완료)까지 마친 중개사만 허용
export function isApprovedBroker(user: User | null) {
  return user?.role === "중개사" && user.brokerVerification === "승인 완료";
}

// PROP-08·09 수정·삭제 권한 — 승인 완료 중개사 중에서도 본인이 등록한 매물만
export function canManageProperty(user: User | null, property: Property) {
  return isApprovedBroker(user) && user?.id === property.brokerId;
}
