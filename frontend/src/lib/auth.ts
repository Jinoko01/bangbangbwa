import type { User } from "@/types";

// PROP-07~09 매물 등록·수정·삭제 권한 — 인증(승인 완료)까지 마친 중개사만 허용.
// 수정·삭제는 여기에 더해 본인이 등록한 매물이어야 한다 (useIsMyProperty)
export function isApprovedBroker(user: User | null) {
  return user?.role === "중개사" && user.brokerVerification === "승인 완료";
}
