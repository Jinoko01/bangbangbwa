import {
  useActionState,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import {
  Navigate,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { ChevronLeft, ImageIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { BUILDING_TYPES, REGIONS } from "@/data/properties";
import { isApprovedBroker } from "@/lib/auth";
import { readFileAsDataUrl } from "@/lib/file";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import type { BuildingType, DealType, Property } from "@/types";

const DEAL_TYPES: DealType[] = ["전세", "월세", "매매"];

const DEPOSIT_LABEL: Record<DealType, string> = {
  전세: "전세 보증금 (만원)",
  월세: "보증금 (만원)",
  매매: "매매가 (만원)",
};

function FormSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="border-b pb-2 text-sm font-semibold">{title}</h2>
      <div className="grid gap-4 pt-5 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function FormField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-2 text-sm font-medium", className)}>
      {label}
      {children}
    </label>
  );
}

// 거래 유형 선택 — 예약 페이지 탭과 동일한 세그먼트 패턴
function DealTypeSegment({
  value,
  onChange,
}: {
  value: DealType;
  onChange: (dealType: DealType) => void;
}) {
  return (
    <div className="inline-flex self-start rounded-lg bg-muted p-1">
      {DEAL_TYPES.map((dealType) => (
        <button
          key={dealType}
          type="button"
          aria-pressed={value === dealType}
          className={cn(
            "rounded-md px-4 py-1.5 text-sm transition-colors",
            value === dealType
              ? "bg-background font-semibold text-primary shadow-sm"
              : "text-muted-foreground",
          )}
          onClick={() => onChange(dealType)}
        >
          {dealType}
        </button>
      ))}
    </div>
  );
}

// 대표 사진 — 미리보기 썸네일 + 파일 선택 (imageUrl은 data URL로 보관)
function PhotoField({
  imageUrl,
  onSelect,
}: {
  imageUrl?: string;
  onSelect: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="flex items-center gap-4 sm:col-span-2">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt="대표 사진 미리보기"
          className="h-25 w-40 shrink-0 rounded-lg border object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="grid h-25 w-40 shrink-0 place-items-center rounded-lg bg-muted"
        >
          <ImageIcon className="size-6 text-muted-foreground" />
        </span>
      )}
      <div className="flex flex-col gap-2">
        <Button
          asChild
          variant="outline"
          size="sm"
          className="cursor-pointer self-start has-[:focus-visible]:border-ring has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50"
        >
          <label>
            이미지 변경
            <input
              name="image"
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={onSelect}
            />
          </label>
        </Button>
        <p className="text-xs font-normal text-muted-foreground">
          매물 목록·상세에 노출되는 대표 사진 (JPG·PNG)
        </p>
      </div>
    </div>
  );
}

interface PropertyFormProps {
  property: Property | null;
  nextId: number;
  onSave: (property: Property) => void;
}

function validate(input: {
  title: string;
  dealType: DealType;
  deposit: number;
  monthlyRent: number;
  dong: string;
  areaM2: number;
  floor: number;
  totalFloors: number;
  rooms: number;
}) {
  if (!input.title) {
    return "매물명을 입력해주세요";
  }
  if (!Number.isFinite(input.deposit) || input.deposit <= 0) {
    return `${DEPOSIT_LABEL[input.dealType]}을 입력해주세요`;
  }
  if (
    input.dealType === "월세" &&
    (!Number.isFinite(input.monthlyRent) || input.monthlyRent <= 0)
  ) {
    return "월세를 입력해주세요";
  }
  if (!input.dong) {
    return "동(법정동)을 입력해주세요";
  }
  if (!Number.isFinite(input.areaM2) || input.areaM2 <= 0) {
    return "전용면적을 입력해주세요";
  }
  if (
    !Number.isFinite(input.floor) ||
    !Number.isFinite(input.totalFloors) ||
    input.floor <= 0 ||
    input.totalFloors <= 0
  ) {
    return "층수와 총 층수를 입력해주세요";
  }
  if (input.floor > input.totalFloors) {
    return "층수는 총 층수보다 클 수 없습니다";
  }
  if (!Number.isFinite(input.rooms) || input.rooms <= 0) {
    return "방 개수를 입력해주세요";
  }
  return null;
}

function PropertyForm({ property, nextId, onSave }: PropertyFormProps) {
  const navigate = useNavigate();
  const [dealType, setDealType] = useState<DealType>(
    property?.dealType ?? "전세",
  );
  const [buildingType, setBuildingType] = useState<BuildingType>(
    property?.buildingType ?? "아파트",
  );
  const [region, setRegion] = useState(property?.region ?? REGIONS[0]);
  const [previewUrl, setPreviewUrl] = useState(property?.imageUrl);

  const handleImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      setPreviewUrl(await readFileAsDataUrl(file));
    } catch {
      setPreviewUrl(property?.imageUrl);
    }
  };

  const [error, submitAction, isPending] = useActionState(
    async (_prev: string | null, formData: FormData) => {
      const input = {
        title: String(formData.get("title")).trim(),
        dealType,
        deposit: Number(formData.get("deposit")),
        monthlyRent:
          dealType === "월세" ? Number(formData.get("monthlyRent")) : 0,
        dong: String(formData.get("dong")).trim(),
        areaM2: Number(formData.get("areaM2")),
        floor: Number(formData.get("floor")),
        totalFloors: Number(formData.get("totalFloors")),
        rooms: Number(formData.get("rooms")),
      };
      const validationError = validate(input);
      if (validationError) {
        return validationError;
      }

      const imageFile = formData.get("image");
      const hasNewImage = imageFile instanceof File && imageFile.size > 0;
      try {
        const imageUrl = hasNewImage
          ? await readFileAsDataUrl(imageFile)
          : property?.imageUrl;
        const next: Property = {
          ...input,
          id: property?.id ?? nextId,
          buildingType,
          region,
          saved: property?.saved ?? false,
          imageUrl,
        };
        onSave(next);
        navigate(`/properties/${next.id}`, { replace: true });
        return null;
      } catch {
        return "이미지를 처리하지 못했습니다. 잠시 후 다시 시도해주세요";
      }
    },
    null,
  );

  return (
    <form action={submitAction} className="flex flex-col gap-10">
      <FormSection title="기본 정보">
        <FormField label="매물명" className="sm:col-span-2">
          <Input name="title" defaultValue={property?.title} />
        </FormField>
        <FormField label="거래 유형">
          <DealTypeSegment value={dealType} onChange={setDealType} />
        </FormField>
        <FormField label="건물 유형">
          <Select
            value={buildingType}
            onValueChange={(value) => setBuildingType(value as BuildingType)}
          >
            <SelectTrigger aria-label="건물 유형" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BUILDING_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label={DEPOSIT_LABEL[dealType]}>
          <Input
            name="deposit"
            type="number"
            min={1}
            defaultValue={property?.deposit}
          />
        </FormField>
        <FormField
          label="월세 (만원)"
          className={dealType !== "월세" ? "text-muted-foreground" : undefined}
        >
          <Input
            name="monthlyRent"
            type="number"
            min={1}
            defaultValue={property?.monthlyRent || undefined}
            disabled={dealType !== "월세"}
          />
          {dealType !== "월세" && (
            <span className="text-xs font-normal">
              월세 거래일 때만 입력할 수 있어요
            </span>
          )}
        </FormField>
      </FormSection>

      <FormSection title="위치 정보">
        <FormField label="지역 (구)">
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger aria-label="지역" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REGIONS.map((regionOption) => (
                <SelectItem key={regionOption} value={regionOption}>
                  {regionOption}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="동">
          <Input name="dong" defaultValue={property?.dong} />
        </FormField>
      </FormSection>

      <FormSection title="상세 정보">
        <FormField label="전용면적 (㎡)">
          <Input
            name="areaM2"
            type="number"
            min={1}
            defaultValue={property?.areaM2}
          />
        </FormField>
        <FormField label="방 개수">
          <Input
            name="rooms"
            type="number"
            min={1}
            defaultValue={property?.rooms}
          />
        </FormField>
        <FormField label="층">
          <Input
            name="floor"
            type="number"
            min={1}
            defaultValue={property?.floor}
          />
        </FormField>
        <FormField label="총 층수">
          <Input
            name="totalFloors"
            type="number"
            min={1}
            defaultValue={property?.totalFloors}
          />
        </FormField>
      </FormSection>

      <FormSection title="대표 사진">
        <PhotoField imageUrl={previewUrl} onSelect={handleImageChange} />
      </FormSection>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center justify-between gap-4 border-t pt-4">
        <p className="text-sm text-muted-foreground">
          저장하면 매물 목록·상세에 바로 반영됩니다.
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            취소
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "저장 중..." : property ? "저장하기" : "등록하기"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function FormPageSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="h-25 w-40" />
    </div>
  );
}

interface PropertyFormPageProps {
  loading: boolean;
  properties: Property[];
  onSave: (property: Property) => void;
}

// PAGE-07 매물 등록·수정 — 중개사(승인 완료) 전용, 등록(PROP-07)과 수정(PROP-08)이 같은 폼을 공유
function PropertyFormPage({
  loading,
  properties,
  onSave,
}: PropertyFormPageProps) {
  const { id: idParam } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  if (!isApprovedBroker(user)) {
    return <Navigate to="/properties" replace />;
  }

  const isEdit = idParam !== undefined;
  const property = isEdit
    ? (properties.find((p) => p.id === Number(idParam)) ?? null)
    : null;
  const nextId = properties.reduce((max, p) => Math.max(max, p.id), 0) + 1;

  return (
    <div className="min-h-svh bg-background">
      {/* top-14: 공통 GNB(h-14) 아래에 고정 */}
      <header className="sticky top-14 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            aria-label="뒤로 가기"
            onClick={() => navigate(-1)}
          >
            <ChevronLeft />
          </Button>
          <h1 className="text-lg font-semibold">
            {isEdit ? "매물 수정" : "매물 등록"}
          </h1>
          <Badge variant="secondary" className="ml-auto">
            중개사 전용
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {loading ? (
          <FormPageSkeleton />
        ) : isEdit && !property ? (
          <div className="flex flex-col items-center gap-3 py-24 text-center">
            <p className="font-medium">매물을 찾을 수 없습니다</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/properties")}
            >
              목록으로 돌아가기
            </Button>
          </div>
        ) : (
          <PropertyForm property={property} nextId={nextId} onSave={onSave} />
        )}
      </main>
    </div>
  );
}

export default PropertyFormPage;
