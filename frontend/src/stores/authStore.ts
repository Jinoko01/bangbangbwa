import { create } from "zustand";

import * as authApi from "@/api/auth";
import type {
  AuthProvider,
  BrokerVerificationRequest,
  User,
  UserProfileChanges,
} from "@/types";

interface AuthStore {
  user: User | null;
  login: (provider: AuthProvider) => Promise<User>;
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
  login: async (provider) => {
    const user =
      provider === "kakao"
        ? await authApi.loginWithKakao()
        : await authApi.loginWithGoogle();
    set({ user });
    return user;
  },
  loginAsMockBroker: async (brokerId) => {
    const user = await authApi.loginWithMockBroker(brokerId);
    set({ user });
    return user;
  },
  logout: async () => {
    await authApi.logout();
    set({ user: null });
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
  withdraw: async () => {
    await authApi.withdraw();
    set({ user: null });
  },
}));
