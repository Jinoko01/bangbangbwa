import type { User, UserProfileChanges } from "@/types";

// AUTH-01·02, USER-01~03 인증·회원 API 스텁.
// 백엔드 완성 후 이 파일만 교체하면 됨.
// 카카오/구글 키는 .env(VITE_KAKAO_KEY 등)에서 읽을 것, 코드에 하드코딩 금지.

const MOCK_USER: Omit<User, "provider"> = {
  name: "김방방",
  nickname: "방방이",
  email: "bangbang@example.com",
  phone: "010-1234-5678",
  role: "세입자",
};

// TODO: 카카오 OAuth 연동 (import.meta.env.VITE_KAKAO_KEY)
export async function loginWithKakao(): Promise<User> {
  return { ...MOCK_USER, provider: "kakao" };
}

// TODO: 구글 OAuth 연동 (import.meta.env.VITE_GOOGLE_CLIENT_ID)
export async function loginWithGoogle(): Promise<User> {
  return { ...MOCK_USER, provider: "google" };
}

// TODO: 세션·토큰 무효화
export async function logout() {}

// TODO: USER-02 내 정보 수정 API 연동
export async function updateProfile(
  user: User,
  changes: UserProfileChanges,
): Promise<User> {
  return { ...user, ...changes };
}

// TODO: USER-03 회원 탈퇴 API 연동
export async function withdraw() {}
