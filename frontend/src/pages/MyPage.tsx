import { useActionState, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import type { User } from "@/types";

// 프로필 요약 — 아바타·이름·역할·이메일 (USER-01)
function ProfileCard({ user }: { user: User }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <span
          aria-hidden
          className="grid size-16 shrink-0 place-items-center rounded-full bg-accent text-2xl font-semibold text-accent-foreground"
        >
          {user.name[0]}
        </span>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <p className="text-lg font-semibold">{user.name}</p>
            <Badge>{user.role}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// 내 정보 조회·수정 (USER-01·02)
function ProfileInfoCard({ user }: { user: User }) {
  const [editOpen, setEditOpen] = useState(false);

  const infoRows = [
    { label: "이름", value: user.name },
    { label: "닉네임", value: user.nickname },
    { label: "이메일", value: user.email },
    { label: "연락처", value: user.phone },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">내 정보</CardTitle>
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          수정
        </Button>
      </CardHeader>
      <CardContent>
        <dl className="divide-y">
          {infoRows.map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between py-3">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="text-sm font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
      <ProfileEditDialog
        user={user}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </Card>
  );
}

// 내 정보 수정 폼 — 소셜 로그인 제공 항목(이름·이메일)은 수정 불가
function ProfileEditDialog({
  user,
  open,
  onOpenChange,
}: {
  user: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { updateProfile } = useAuth();

  const [error, submitAction, isPending] = useActionState(
    async (_prev: string | null, formData: FormData) => {
      const nickname = String(formData.get("nickname")).trim();
      const phone = String(formData.get("phone")).trim();
      if (!nickname) {
        return "닉네임을 입력해주세요";
      }
      if (!phone) {
        return "연락처를 입력해주세요";
      }
      try {
        await updateProfile({ nickname, phone });
        onOpenChange(false);
        return null;
      } catch {
        return "정보 수정에 실패했습니다. 잠시 후 다시 시도해주세요";
      }
    },
    null,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>내 정보 수정</DialogTitle>
          <DialogDescription>
            닉네임과 연락처를 변경할 수 있습니다.
          </DialogDescription>
        </DialogHeader>
        <form action={submitAction} className="flex flex-col gap-4">
          <label className="flex flex-col gap-2 text-sm font-medium">
            닉네임
            <Input name="nickname" defaultValue={user.nickname} />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">
            연락처
            <Input name="phone" type="tel" defaultValue={user.phone} />
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              취소
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "저장 중..." : "저장"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// 계정 관리 — 로그아웃(AUTH-02)·회원 탈퇴(USER-03)
function AccountCard() {
  const { logout, withdraw } = useAuth();
  const navigate = useNavigate();
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  const [logoutError, logoutAction, isLoggingOut] = useActionState(async () => {
    try {
      await logout();
      navigate("/", { replace: true });
      return null;
    } catch {
      return "로그아웃에 실패했습니다. 잠시 후 다시 시도해주세요";
    }
  }, null);

  const [withdrawError, withdrawAction, isWithdrawing] = useActionState(
    async () => {
      try {
        await withdraw();
        navigate("/", { replace: true });
        return null;
      } catch {
        return "회원 탈퇴에 실패했습니다. 잠시 후 다시 시도해주세요";
      }
    },
    null,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">계정 관리</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">로그아웃</p>
            <p className="text-sm text-muted-foreground">
              현재 기기에서 로그아웃합니다.
            </p>
          </div>
          <form action={logoutAction}>
            <Button type="submit" variant="outline" disabled={isLoggingOut}>
              <LogOut />
              로그아웃
            </Button>
          </form>
        </div>
        {logoutError && (
          <p className="text-sm text-destructive">{logoutError}</p>
        )}
        <div className="border-t" />
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-destructive">회원 탈퇴</p>
            <p className="text-sm text-muted-foreground">
              탈퇴 시 저장한 매물과 리포트가 모두 삭제되며 복구할 수 없습니다.
            </p>
          </div>
          <Button
            variant="outline"
            className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive"
            onClick={() => setWithdrawOpen(true)}
          >
            탈퇴하기
          </Button>
        </div>
        <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>정말 탈퇴하시겠어요?</DialogTitle>
              <DialogDescription>
                탈퇴하면 계정 정보와 저장한 매물, 리포트가 모두 삭제되며 되돌릴
                수 없습니다.
              </DialogDescription>
            </DialogHeader>
            {withdrawError && (
              <p className="text-sm text-destructive">{withdrawError}</p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setWithdrawOpen(false)}>
                취소
              </Button>
              <form action={withdrawAction}>
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={isWithdrawing}
                >
                  {isWithdrawing ? "처리 중..." : "탈퇴하기"}
                </Button>
              </form>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// PAGE-02 마이페이지 — 내 정보 조회·수정·탈퇴·로그아웃
function MyPage() {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" state={{ from: "/mypage" }} replace />;
  }

  return (
    <main className="min-h-[calc(100svh-3.5rem)] bg-muted/40 px-4 py-10">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
        <header>
          <h1 className="text-2xl font-semibold">마이페이지</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            내 정보를 확인하고 계정을 관리하세요.
          </p>
        </header>
        <ProfileCard user={user} />
        <ProfileInfoCard user={user} />
        <AccountCard />
      </div>
    </main>
  );
}

export default MyPage;
