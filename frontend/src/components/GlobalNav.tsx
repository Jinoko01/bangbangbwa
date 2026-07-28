import { useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { LogOut, Menu, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";

interface NavItemConfig {
  label: string;
  to: string | null;
  authRequired?: boolean;
}

const NAV_ITEMS: NavItemConfig[] = [
  { label: "매물 목록", to: "/properties" },
  { label: "관심 매물", to: "/saved", authRequired: true },
  { label: "예약 확인", to: "/reservations", authRequired: true },
];

function NavItem({
  item,
  onNavigate,
}: {
  item: NavItemConfig;
  onNavigate?: () => void;
}) {
  if (!item.to) {
    // 미구현 경로 — 비활성 톤
    return (
      <span
        aria-disabled="true"
        title="준비 중"
        className="cursor-not-allowed text-sm text-muted-foreground/50"
      >
        {item.label}
      </span>
    );
  }
  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "text-sm transition-colors hover:text-foreground",
          isActive ? "font-semibold text-foreground" : "text-muted-foreground",
        )
      }
    >
      {item.label}
    </NavLink>
  );
}

function AuthArea({
  compact = false,
  onNavigate,
}: {
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const user = useAuthStore((state) => state.user);
  const isSessionRestored = useAuthStore((state) => state.isSessionRestored);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const location = useLocation();

  // 세션 복원 전에는 로그인 버튼을 먼저 보여줬다가 아바타로 바뀌는 깜빡임이 생긴다
  if (!isSessionRestored) {
    return <Skeleton className="h-8 w-24" />;
  }

  if (!user) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          onNavigate?.();
          navigate("/login", { state: { from: location.pathname } });
        }}
      >
        로그인
      </Button>
    );
  }

  return (
    <div className={cn("flex items-center", compact ? "gap-3" : "gap-2")}>
      <Link
        to="/mypage"
        onClick={onNavigate}
        className="flex items-center gap-2 rounded-md p-1 pr-2 transition-colors hover:bg-muted"
        aria-label="마이페이지"
      >
        <span
          aria-hidden
          className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
        >
          {user.name.charAt(0) || user.nickname.charAt(0) || "?"}
        </span>
        <span className="text-sm font-medium">
          {user.name || user.nickname || "내 계정"}
        </span>
      </Link>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          onNavigate?.();
          logout();
        }}
      >
        <LogOut />
        로그아웃
      </Button>
    </div>
  );
}

// 공통 GNB — App 레이아웃 레벨에서 모든 페이지 상단에 표시 (h-14 고정)
function GlobalNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);
  const user = useAuthStore((state) => state.user);
  // ADMIN-01 인증 심사 메뉴는 관리자 계정에만 노출
  const navItems = NAV_ITEMS.filter((item) => user || !item.authRequired);
  if (user?.role === "관리자") {
    navItems.push({ label: "인증 심사", to: "/admin" });
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <nav className="relative mx-auto flex h-14 max-w-6xl items-center gap-8 px-4">
        <Link
          to="/"
          className="flex items-center gap-2 text-lg font-bold text-primary"
          onClick={closeMenu}
        >
          <img
            src="/logo-symbol.png"
            alt=""
            className="h-7 w-auto rounded-md bg-white"
          />
          방방봐
        </Link>

        <div className="hidden items-center gap-6 sm:flex">
          {navItems.map((item) => (
            <NavItem key={item.label} item={item} />
          ))}
        </div>

        <div className="absolute right-0 hidden items-center gap-1 sm:flex xl:-right-8">
          <AuthArea />
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="ml-auto sm:hidden"
          aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? <X /> : <Menu />}
        </Button>

        {menuOpen && (
          <div className="absolute inset-x-0 top-full flex flex-col gap-4 border-b bg-background px-4 py-4 shadow-md sm:hidden">
            {navItems.map((item) => (
              <NavItem key={item.label} item={item} onNavigate={closeMenu} />
            ))}
            <div className="border-t pt-4">
              <AuthArea compact onNavigate={closeMenu} />
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}

export default GlobalNav;
