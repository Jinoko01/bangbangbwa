import { create } from "zustand";

import * as authApi from "@/api/auth";
import { deleteMyAccount, getMyInfo } from "@/api/user";
import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from "@/lib/authToken";
import type {
  AuthProvider,
  BrokerVerificationRequest,
  User,
  UserProfileChanges,
} from "@/types";

interface AuthStore {
  user: User | null;
  restoreSession: () => Promise<void>;
  completeSocialLogin: (
    provider: AuthProvider,
    authorizationCode: string,
  ) => Promise<User>;
  loginAsMockBroker: (brokerId: number) => Promise<User>;
  logout: () => Promise<void>;
  updateProfile: (changes: UserProfileChanges) => Promise<User>;
  applyBrokerVerification: (
    request: BrokerVerificationRequest,
  ) => Promise<User>;
  withdraw: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  // 앱 로드 시 저장된 토큰으로 로그인 상태 복원. 토큰이 없거나 만료면 로그아웃 상태 유지
  restoreSession: async () => {
    if (!getAccessToken()) {
      return;
    }
    try {
      const user = await getMyInfo();
      set({ user });
    } catch {
      clearAccessToken();
      set({ user: null });
    }
  },
  // OAuth 콜백에서 받은 인가 코드 → accessToken 발급 → 내 정보 조회로 세션 확정
  completeSocialLogin: async (provider, authorizationCode) => {
    const login =
      provider === "kakao" ? authApi.kakaoLogin : authApi.googleLogin;
    const { accessToken } = await login(authorizationCode);
    setAccessToken(accessToken);
    try {
      const user = await getMyInfo();
      set({ user });
      return user;
    } catch (error) {
      clearAccessToken();
      throw error;
    }
  },
  loginAsMockBroker: async (brokerId) => {
    const user = await authApi.loginWithMockBroker(brokerId);
    set({ user });
    return user;
  },
  // 서버 로그아웃 실패해도 클라이언트는 항상 로그아웃 상태로 만든다
  logout: async () => {
    try {
      await authApi.logout();
    } finally {
      clearAccessToken();
      set({ user: null });
    }
  },
  updateProfile: async (changes) => {
    const currentUser = get().user;

    if (!currentUser) {
      throw new Error("로그인 상태에서만 정보를 수정할 수 있습니다");
    }

    const user = await authApi.updateProfile(currentUser, changes);
    set({ user });
    return user;
  },
  applyBrokerVerification: async (request) => {
    const currentUser = get().user;

    if (!currentUser) {
      throw new Error("로그인 상태에서만 중개사 인증을 신청할 수 있습니다");
    }

    const user = await authApi.applyBrokerVerification(currentUser, request);
    set({ user });
    return user;
  },
  // 회원 탈퇴는 서버 성공 시에만 로컬 세션 정리 (실패 시 로그인 유지 + 에러 노출)
  withdraw: async () => {
    await deleteMyAccount();
    clearAccessToken();
    set({ user: null });
  },
}));
