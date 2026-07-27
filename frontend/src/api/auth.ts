import { api } from "@/api/client";
import type {
  AuthProvider,
  BrokerVerificationRequest,
  User,
  UserProfileChanges,
} from "@/types";

// AUTH-01 소셜 로그인 / AUTH-02 로그아웃 (/api/auth/*).
// 프로필 수정·중개사 인증은 백엔드 미완성이라 아직 목 스텁으로 남겨둔다.

// AUTH-01 소셜 로그인 응답 — accessToken은 authStore가 localStorage에 저장한다.
interface TokenResponse {
  tokenType: string;
  accessToken: string;
  expiresIn: number;
  newUser: boolean;
}

function socialLogin(
  provider: AuthProvider,
  authorizationCode: string,
): Promise<TokenResponse> {
  console.log(`socialLogin(${provider}, ${{ authorizationCode }})`);
  return api.post<TokenResponse>({
    path: `/api/auth/${provider}`,
    body: { authorizationCode },
  });
}

// 카카오/구글 인가 코드를 백엔드로 넘겨 accessToken을 발급받는다.
export function kakaoLogin(authorizationCode: string): Promise<TokenResponse> {
  return socialLogin("kakao", authorizationCode);
}

export function googleLogin(authorizationCode: string): Promise<TokenResponse> {
  return socialLogin("google", authorizationCode);
}

// AUTH-02 로그아웃 — 서버 세션·토큰 무효화 (로컬 토큰 정리는 authStore 책임)
export function logout(): Promise<void> {
  return api.post<void>({ path: "/api/auth/logout" });
}

// id는 data/properties.ts의 brokerId와 연결됨 — 중개사별 매물 구분 테스트용 2계정
const MOCK_BROKERS: Array<Omit<User, "provider">> = [
  {
    id: 1,
    name: "박중개",
    birth: "1990-08-21",
    nickname: "방방부동산",
    email: "broker@example.com",
    phone: "010-9876-5432",
    role: "중개사",
    brokerVerification: "승인 완료",
  },
  {
    id: 2,
    name: "이중개",
    birth: "1987-02-11",
    nickname: "봐봐부동산",
    email: "broker2@example.com",
    phone: "010-2468-1357",
    role: "중개사",
    brokerVerification: "승인 완료",
  },
];

// 로그인 페이지의 개발용 테스트 계정 버튼에 노출할 중개사 목록
export const MOCK_BROKER_ACCOUNTS = MOCK_BROKERS.map(
  ({ id, name, nickname }) => ({ id, name, nickname }),
);

// 개발용 — 중개사별 매물 구분 테스트를 위해 특정 목 중개사로 로그인
export async function loginWithMockBroker(brokerId: number): Promise<User> {
  const broker = MOCK_BROKERS.find((b) => b.id === brokerId) ?? MOCK_BROKERS[0];
  return { ...broker, provider: "google" };
}

// TODO: USER-02 내 정보 수정 API 연동
export async function updateProfile(
  user: User,
  changes: UserProfileChanges,
): Promise<User> {
  return { ...user, ...changes };
}

// TODO: 중개사 인증 신청 API 연동 (등록번호·서류 업로드, 관리자 수동 승인)
export async function applyBrokerVerification(
  user: User,
  request: BrokerVerificationRequest,
): Promise<User> {
  void request;
  return { ...user, brokerVerification: "심사 중" };
}
