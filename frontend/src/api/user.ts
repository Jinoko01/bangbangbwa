import { api } from "@/api/client";
import type { AuthProvider, User } from "@/types";

// USER-01 내 정보 조회 / USER-03 회원 탈퇴 (/api/users/me)

interface OAuthInfo {
  provider: string;
  email: string;
  profileImage: string;
}

interface UserResponse {
  userId: number;
  nickname: string;
  name: string;
  birth: string;
  phone: string;
  role: "TENANT" | "AGENT" | "ADMIN";
  oauthAccounts: OAuthInfo[];
}

function toAuthProvider(provider: string | undefined): AuthProvider {
  return provider?.toLowerCase().includes("google") ? "google" : "kakao";
}

// 백엔드 UserResponse → 프론트 도메인 User.
// role은 TENANT→세입자 / AGENT·ADMIN→중개사, brokerVerification은 응답에 없어 role로 파생.
// email·provider·프로필 이미지는 첫 OAuth 계정에서 가져온다.
function toUser(dto: UserResponse): User {
  const account = dto.oauthAccounts[0];
  const isBroker = dto.role === "AGENT" || dto.role === "ADMIN";

  return {
    id: dto.userId,
    name: dto.name,
    birth: dto.birth,
    nickname: dto.nickname,
    email: account?.email ?? "",
    phone: dto.phone,
    profileImageUrl: account?.profileImage || undefined,
    role: isBroker ? "중개사" : "세입자",
    brokerVerification: isBroker ? "승인 완료" : "미신청",
    provider: toAuthProvider(account?.provider),
  };
}

export async function getMyInfo(signal?: AbortSignal): Promise<User> {
  const dto = await api.get<UserResponse>({
    path: "/api/users/me",
    config: { signal },
  });
  return toUser(dto);
}

export function deleteMyAccount(): Promise<void> {
  return api.delete<void>({ path: "/api/users/me" });
}
