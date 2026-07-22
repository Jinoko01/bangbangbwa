import type {
  BrokerVerificationRequest,
  User,
  UserProfileChanges,
} from "@/types";

// AUTH-01·02, USER-01~03 인증·회원 API 스텁.
// 백엔드 완성 후 이 파일만 교체하면 됨.
// 카카오/구글 키는 .env(VITE_KAKAO_KEY 등)에서 읽을 것, 코드에 하드코딩 금지.

// 데모용 계정 분리 — 카카오: 세입자, 구글: 승인 완료 중개사(1번).
// 실제 중개사 인증(관리자 승인) 연동 시 하나의 계정 흐름으로 되돌릴 것.
const MOCK_TENANT: Omit<User, "provider"> = {
  id: 100,
  name: "김방방",
  birth: "1998-03-14",
  nickname: "방방이",
  email: "bangbang@example.com",
  phone: "010-1234-5678",
  role: "세입자",
  brokerVerification: "미신청",
};

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

// TODO: 카카오 OAuth 연동 (import.meta.env.VITE_KAKAO_KEY)
export async function loginWithKakao(): Promise<User> {
  return { ...MOCK_TENANT, provider: "kakao" };
}

// TODO: 구글 OAuth 연동 (import.meta.env.VITE_GOOGLE_CLIENT_ID)
export async function loginWithGoogle(): Promise<User> {
  return { ...MOCK_BROKERS[0], provider: "google" };
}

// 개발용 — 중개사별 매물 구분 테스트를 위해 특정 목 중개사로 로그인
export async function loginWithMockBroker(brokerId: number): Promise<User> {
  const broker = MOCK_BROKERS.find((b) => b.id === brokerId) ?? MOCK_BROKERS[0];
  return { ...broker, provider: "google" };
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

// TODO: 중개사 인증 신청 API 연동 (등록번호·서류 업로드, 관리자 수동 승인)
export async function applyBrokerVerification(
  user: User,
  request: BrokerVerificationRequest,
): Promise<User> {
  void request;
  return { ...user, brokerVerification: "심사 중" };
}

// TODO: USER-03 회원 탈퇴 API 연동
export async function withdraw() {}
