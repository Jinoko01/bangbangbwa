import {
  useActionState,
  useEffect,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { ImageIcon, LogOut } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyPropertyList } from "@/hooks/queries/propertyQueries";
import { useAuthStore } from "@/stores/authStore";
import { isApprovedBroker } from "@/lib/auth";
import { readFileAsDataUrl } from "@/lib/file";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AuthProvider, BrokerVerificationStatus, User } from "@/types";

const PROVIDER_LABEL: Record<AuthProvider, string> = {
  kakao: "카카오",
  google: "Google",
};

function ProfileAvatar({
  user,
  imageUrl = user.profileImageUrl,
  className,
}: {
  user: User;
  imageUrl?: string;
  className?: string;
}) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt="프로필 이미지"
        className={cn("size-20 shrink-0 rounded-full object-cover", className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-20 shrink-0 place-items-center rounded-full bg-accent text-2xl font-semibold text-accent-foreground",
        className,
      )}
    >
      {user.nickname.charAt(0) || user.name.charAt(0) || "?"}
    </span>
  );
}

// 신원 레일 — 프로필·역할·로그인 계정·중개사 인증까지 "나"에 대한 정보를 한 곳에 (USER-01)
function IdentityRail({ user }: { user: User }) {
  return (
    <aside className="flex flex-col gap-6 self-start md:sticky md:top-24">
      <div className="flex items-center gap-4 md:flex-col md:items-start">
        <ProfileAvatar user={user} />
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <p className="text-xl font-semibold">
              {user.nickname || user.name || "내 계정"}
            </p>
            <Badge>{user.role}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <p className="text-xs text-muted-foreground">
            {PROVIDER_LABEL[user.provider]} 계정으로 로그인
          </p>
        </div>
      </div>
      <BrokerVerificationPanel user={user} />
    </aside>
  );
}

// 문서형 섹션 공통 헤더 — 밑줄 하나로 위계를 만들고 카드 박스는 쓰지 않는다
function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex h-9 items-center justify-between border-b pb-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      {action}
    </div>
  );
}

// 내 정보 — 조회(USER-01)와 페이지 내 수정(USER-02) 모드 전환
function ProfileSection({ user }: { user: User }) {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return <ProfileEditForm user={user} onDone={() => setIsEditing(false)} />;
  }

  const infoRows = [
    { label: "이름", value: user.name },
    { label: "생년월일", value: user.birth.replaceAll("-", ".") },
    { label: "전화번호", value: user.phone },
    { label: "닉네임", value: user.nickname },
    { label: "이메일", value: user.email },
  ];

  return (
    <section>
      <SectionHeader
        title="내 정보"
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(true)}
          >
            수정
          </Button>
        }
      />
      <dl>
        {infoRows.map(({ label, value }) => (
          <div key={label} className="flex items-baseline gap-4 py-3">
            <dt className="w-20 shrink-0 text-sm text-muted-foreground">
              {label}
            </dt>
            <span
              aria-hidden
              className="min-w-8 flex-1 border-b border-dotted border-border"
            />
            <dd
              className={cn(
                "text-sm font-medium",
                !value && "font-normal text-muted-foreground",
              )}
            >
              {value || "미입력"}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// 편집 필드 — 중개사 인증 다이얼로그와 동일한 라벨 위 + 표준 인풋 패턴
function ProfileEditField({
  label,
  name,
  type = "text",
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue: string;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium">
      {label}
      <Input name={name} type={type} defaultValue={defaultValue} />
    </label>
  );
}

// 내 정보 수정 폼 — 이름과 이메일은 조회만 가능
function ProfileEditForm({ user, onDone }: { user: User; onDone: () => void }) {
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
  };

  const [error, submitAction, isPending] = useActionState(
    async (_prev: string | null, formData: FormData) => {
      const birth = String(formData.get("birth"));
      const nickname = String(formData.get("nickname")).trim();
      const phone = String(formData.get("phone")).trim();
      if (!birth) {
        return "생년월일을 입력해주세요";
      }
      if (!phone) {
        return "전화번호를 입력해주세요";
      }
      if (!nickname) {
        return "닉네임을 입력해주세요";
      }

      const imageFile = formData.get("profileImage");
      const hasNewImage = imageFile instanceof File && imageFile.size > 0;
      try {
        const profileImageUrl = hasNewImage
          ? await readFileAsDataUrl(imageFile)
          : user.profileImageUrl;
        await updateProfile({ birth, nickname, phone, profileImageUrl });
        onDone();
        return null;
      } catch {
        return "정보 수정에 실패했습니다. 잠시 후 다시 시도해주세요";
      }
    },
    null,
  );

  return (
    <section>
      <form action={submitAction}>
        <SectionHeader
          title="내 정보"
          action={
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={onDone}>
                취소
              </Button>
              <Button type="submit" size="sm" disabled={isPending}>
                {isPending ? "저장 중..." : "저장"}
              </Button>
            </div>
          }
        />
        <div className="flex flex-col gap-5 pt-5">
          <div className="flex items-center gap-4">
            <ProfileAvatar
              user={user}
              imageUrl={previewUrl ?? user.profileImageUrl}
              className="size-16 text-xl"
            />
            <Button
              asChild
              variant="outline"
              size="sm"
              className="cursor-pointer has-[:focus-visible]:border-ring has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50"
            >
              <label>
                이미지 변경
                <input
                  name="profileImage"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleImageChange}
                />
              </label>
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">이름</span>
              <p className="py-2 text-sm">{user.name}</p>
              <p className="text-xs text-muted-foreground">
                본인 확인 정보 · 변경 불가
              </p>
            </div>
            <ProfileEditField
              label="생년월일"
              name="birth"
              type="date"
              defaultValue={user.birth}
            />
            <ProfileEditField
              label="전화번호"
              name="phone"
              type="tel"
              defaultValue={user.phone}
            />
            <ProfileEditField
              label="닉네임"
              name="nickname"
              defaultValue={user.nickname}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">이메일</span>
            <p className="text-sm">{user.email}</p>
            <p className="text-xs text-muted-foreground">
              {PROVIDER_LABEL[user.provider]} 계정 이메일 · 변경 불가
            </p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </form>
    </section>
  );
}

const BROKER_VERIFICATION_DESCRIPTION: Record<
  BrokerVerificationStatus,
  string
> = {
  미신청:
    "중개업등록번호와 증빙 서류를 제출하면 관리자 확인 후 중개사 계정으로 전환됩니다.",
  "심사 중":
    "제출하신 서류를 관리자가 확인하고 있습니다. 승인이 완료되면 중개사 계정으로 전환됩니다.",
  "승인 완료": "중개사 인증이 완료된 계정입니다.",
  반려: "제출하신 신청이 반려되었습니다. 아래 사유를 확인하고 다시 신청해 주세요.",
};

const BROKER_VERIFICATION_BADGE_VARIANT: Record<
  BrokerVerificationStatus,
  "default" | "secondary" | "destructive"
> = {
  미신청: "secondary",
  "심사 중": "secondary",
  "승인 완료": "default",
  반려: "destructive",
};

// 중개사 인증 — 등록번호·서류 제출 후 관리자 수동 승인, 신원 레일에 배치
function BrokerVerificationPanel({ user }: { user: User }) {
  const [applyOpen, setApplyOpen] = useState(false);

  return (
    <div className="border-t pt-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">중개사 인증</h2>
        {user.brokerVerification !== "미신청" && (
          <Badge
            variant={BROKER_VERIFICATION_BADGE_VARIANT[user.brokerVerification]}
          >
            {user.brokerVerification}
          </Badge>
        )}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {BROKER_VERIFICATION_DESCRIPTION[user.brokerVerification]}
      </p>
      {user.brokerVerification === "반려" &&
        user.brokerVerificationRejectReason && (
          <p className="mt-2 rounded-lg bg-destructive/5 p-3 text-xs leading-5 text-destructive">
            반려 사유: {user.brokerVerificationRejectReason}
          </p>
        )}
      {(user.brokerVerification === "미신청" ||
        user.brokerVerification === "반려") && (
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => setApplyOpen(true)}
        >
          {user.brokerVerification === "반려" ? "다시 신청" : "인증 신청"}
        </Button>
      )}
      <BrokerVerificationDialog open={applyOpen} onOpenChange={setApplyOpen} />
    </div>
  );
}

function BrokerVerificationDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const applyBrokerVerification = useAuthStore(
    (state) => state.applyBrokerVerification,
  );

  const [error, submitAction, isPending] = useActionState(
    async (_prev: string | null, formData: FormData) => {
      const registrationNumber = String(
        formData.get("registrationNumber"),
      ).trim();
      const document = formData.get("document");
      if (!registrationNumber) {
        return "중개업등록번호를 입력해주세요";
      }
      if (!(document instanceof File) || document.size === 0) {
        return "중개사 증빙 서류를 첨부해주세요";
      }
      try {
        await applyBrokerVerification({
          registrationNumber,
          documentName: document.name,
        });
        onOpenChange(false);
        return null;
      } catch {
        return "인증 신청에 실패했습니다. 잠시 후 다시 시도해주세요";
      }
    },
    null,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>중개사 인증 신청</DialogTitle>
          <DialogDescription>
            중개업등록번호와 증빙 서류를 제출하면 관리자가 확인 후 승인합니다.
          </DialogDescription>
        </DialogHeader>
        <form action={submitAction} className="flex flex-col gap-4">
          <label className="flex flex-col gap-2 text-sm font-medium">
            중개업등록번호
            <Input
              name="registrationNumber"
              placeholder="예) 11110-2026-00001"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">
            증빙 서류
            <Input name="document" type="file" accept="image/*,.pdf" />
            <span className="text-xs font-normal text-muted-foreground">
              중개사무소 등록증 등 자격을 확인할 수 있는 서류 (PDF·이미지)
            </span>
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
              {isPending ? "신청 중..." : "신청하기"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// PROP-10 내가 올린 매물 — 중개사 본인이 등록한 매물만 모아 보여준다 (GET /api/properties/me)
function MyListingsSection() {
  const navigate = useNavigate();
  const { data, isPending, isError, refetch } = useMyPropertyList();
  const properties = data?.content ?? [];

  return (
    <section>
      <SectionHeader
        title={
          data ? `내가 올린 매물 (${data.totalElements})` : "내가 올린 매물"
        }
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/properties/new")}
          >
            매물 등록
          </Button>
        }
      />
      {isPending ? (
        <div className="flex flex-col gap-3 py-4">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-start gap-3 py-6">
          <p className="text-sm text-muted-foreground">
            매물 목록을 불러오지 못했어요.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            다시 시도
          </Button>
        </div>
      ) : properties.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">
          아직 등록한 매물이 없어요. 첫 매물을 등록해보세요.
        </p>
      ) : (
        <ul>
          {properties.map((property) => (
            <li
              key={property.propertyId}
              className="flex items-center gap-4 border-b py-3 last:border-b-0"
            >
              <span
                aria-hidden
                className="grid h-12 w-16 shrink-0 place-items-center rounded-lg bg-muted"
              >
                <ImageIcon className="size-4 text-muted-foreground" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <button
                  type="button"
                  className="max-w-full self-start truncate text-sm font-medium hover:underline"
                  onClick={() => navigate(`/properties/${property.propertyId}`)}
                >
                  {property.title}
                </button>
                <p className="truncate text-xs text-muted-foreground">
                  {property.sigungu} {property.dong} · {property.roomType} ·{" "}
                  {property.transactionType}{" "}
                  {formatPrice({
                    dealType: property.transactionType,
                    deposit: property.deposit,
                    monthlyRent: property.monthlyRent,
                  })}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0"
                onClick={() =>
                  navigate(`/properties/${property.propertyId}/edit`)
                }
              >
                수정
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// 계정 — 로그아웃(AUTH-02)·회원 탈퇴(USER-03), 카드 없이 조용한 하단 섹션
function AccountSection() {
  const logout = useAuthStore((state) => state.logout);
  const withdraw = useAuthStore((state) => state.withdraw);
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
    <section>
      <SectionHeader title="계정" />
      <div className="flex items-center justify-between gap-4 py-4">
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
      {logoutError && <p className="text-sm text-destructive">{logoutError}</p>}
      <div className="flex items-center justify-between gap-4 border-t py-4">
        <div>
          <p className="text-sm font-medium text-destructive">회원 탈퇴</p>
          <p className="text-sm text-muted-foreground">
            탈퇴 시 저장한 매물과 리포트가 모두 삭제되며 복구할 수 없습니다.
          </p>
        </div>
        <Button
          variant="ghost"
          className="shrink-0 text-destructive hover:bg-destructive/5 hover:text-destructive"
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
              탈퇴하면 계정 정보와 저장한 매물, 리포트가 모두 삭제되며 되돌릴 수
              없습니다.
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
    </section>
  );
}

// PAGE-02 마이페이지 — 내 정보 조회·수정·중개사 인증·내가 올린 매물(중개사)·탈퇴·로그아웃
// 로그인 여부는 라우트의 RequireAuth가 보장하고, user는 그쪽에서 내려받는다
function MyPage({ user }: { user: User }) {
  return (
    <main className="min-h-[calc(100svh-3.5rem)] px-4 py-12">
      <h1 className="sr-only">마이페이지</h1>
      <div className="mx-auto grid w-full max-w-4xl gap-10 md:grid-cols-[15rem_1fr] md:gap-14">
        <IdentityRail user={user} />
        <div className="flex min-w-0 flex-col gap-12">
          <ProfileSection user={user} />
          {isApprovedBroker(user) && <MyListingsSection />}
          <AccountSection />
        </div>
      </div>
    </main>
  );
}

export default MyPage;
