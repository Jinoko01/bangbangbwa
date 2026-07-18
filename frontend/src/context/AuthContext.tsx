import { createContext, useContext, useState, type ReactNode } from "react";

import * as authApi from "@/api/auth";
import type {
  AuthProvider as AuthProviderType,
  User,
  UserProfileChanges,
} from "@/types";

interface AuthContextValue {
  user: User | null;
  login: (provider: AuthProviderType) => Promise<User>;
  logout: () => Promise<void>;
  updateProfile: (changes: UserProfileChanges) => Promise<User>;
  withdraw: () => Promise<void>;
}

// AUTH-01·02 인증 상태 — 우선 메모리 상태만 (새로고침 시 초기화)
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const login = async (provider: AuthProviderType) => {
    const nextUser =
      provider === "kakao"
        ? await authApi.loginWithKakao()
        : await authApi.loginWithGoogle();
    setUser(nextUser);
    return nextUser;
  };

  const logout = async () => {
    await authApi.logout();
    setUser(null);
  };

  const updateProfile = async (changes: UserProfileChanges) => {
    if (!user) {
      throw new Error("로그인 상태에서만 정보를 수정할 수 있습니다");
    }
    const nextUser = await authApi.updateProfile(user, changes);
    setUser(nextUser);
    return nextUser;
  };

  const withdraw = async () => {
    await authApi.withdraw();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, login, logout, updateProfile, withdraw }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth는 AuthProvider 안에서만 사용할 수 있습니다");
  }
  return ctx;
}
