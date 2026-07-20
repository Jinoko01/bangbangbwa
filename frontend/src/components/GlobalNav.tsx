import { useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { LogOut, Menu, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";

interface NavItemConfig {
  label: string;
  to: string | null;
}

const NAV_ITEMS: NavItemConfig[] = [
  { label: "매물 목록", to: "/properties" },
  { label: "관심 매물", to: "/saved" },
  { label: "예약 확인", to: "/reservations" },
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
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const location = useLocation();

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
          {user.name[0]}
        </span>
        <span className="text-sm font-medium">{user.name}</span>
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
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.label} item={item} />
          ))}
        </div>

        <div className="ml-auto hidden items-center gap-1 sm:flex">
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
            {NAV_ITEMS.map((item) => (
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
