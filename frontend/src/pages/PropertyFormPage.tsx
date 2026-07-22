import {
  useActionState,
  useEffect,
  useRef,
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
import { ChevronLeft, ImageIcon, ImagePlus, X } from "lucide-react";

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
import { formatManwonLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import type { BuildingType, DealType, Property } from "@/types";

const DEAL_TYPES: DealType[] = ["전세", "월세", "매매"];

const DEPOSIT_LABEL: Record<DealType, string> = {
  전세: "전세 보증금 (만원)",
  월세: "보증금 (만원)",
  매매: "매매가 (만원)",
};

// 대표 사진을 제외하고 캐러셀에 추가로 넣을 수 있는 사진 수 (총 5장)
const MAX_EXTRA_PHOTOS = 4;

type FormErrors = Record<string, string>;

// React 19가 액션 완료 후 폼을 리셋하므로, 실패 시 values를 되돌려 defaultValue로 복원
interface FormState {
  errors: FormErrors;
  values: Record<string, string>;
}

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
  error,
  children,
  className,
}: {
  label: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-2 text-sm font-medium", className)}>
      {label}
      {children}
      {error && (
        <span className="text-xs font-normal text-destructive">{error}</span>
      )}
    </label>
  );
}

// 만원 단위 금액 입력 — 자릿수 실수 방지를 위해 입력값을 한글 금액으로 실시간 표시
function PriceInput({
  name,
  defaultValue,
  disabled,
  invalid,
}: {
  name: string;
  defaultValue?: number | string;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const [amount, setAmount] = useState(Number(defaultValue ?? 0));

  return (
    <>
      <Input
        name={name}
        type="number"
        min={1}
        defaultValue={defaultValue}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        onChange={(e) => setAmount(Number(e.target.value))}
      />
      {!disabled && amount > 0 && (
        <span className="text-xs font-normal text-muted-foreground">
          = {formatManwonLabel(amount)}
        </span>
      )}
    </>
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

// 추가 사진 — 대표 사진과 함께 상세 캐러셀에 노출 (최대 4장, 총 5장)
function ExtraPhotoField({
  urls,
  onSelect,
  onRemove,
}: {
  urls: string[];
  onSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2 sm:col-span-2">
      <div className="flex flex-wrap gap-3">
        {urls.map((url, index) => (
          <div key={`${index}-${url.slice(-24)}`} className="relative">
            <img
              src={url}
              alt={`추가 사진 ${index + 1}`}
              className="h-20 w-32 rounded-lg border object-cover"
            />
            <Button
              type="button"
              variant="secondary"
              size="icon"
              aria-label={`추가 사진 ${index + 1} 삭제`}
              className="absolute -top-2 -right-2 size-6 rounded-full border shadow-sm"
              onClick={() => onRemove(index)}
            >
              <X className="size-3.5" />
            </Button>
          </div>
        ))}
        {urls.length < MAX_EXTRA_PHOTOS && (
          <label className="grid h-20 w-32 cursor-pointer place-items-center rounded-lg border border-dashed transition-colors hover:bg-muted has-[:focus-visible]:border-ring has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50">
            <span className="flex flex-col items-center gap-1 text-xs font-normal text-muted-foreground">
              <ImagePlus className="size-5" />
              사진 추가
            </span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={onSelect}
            />
          </label>
        )}
      </div>
      <p className="text-xs font-normal text-muted-foreground">
        상세 캐러셀에 함께 노출되는 사진 (최대 {MAX_EXTRA_PHOTOS}장)
      </p>
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
  const errors: FormErrors = {};
  if (!input.title) {
    errors.title = "매물명을 입력해주세요";
  }
  if (!Number.isFinite(input.deposit) || input.deposit <= 0) {
    errors.deposit = `${DEPOSIT_LABEL[input.dealType]}을 입력해주세요`;
  }
  if (
    input.dealType === "월세" &&
    (!Number.isFinite(input.monthlyRent) || input.monthlyRent <= 0)
  ) {
    errors.monthlyRent = "월세를 입력해주세요";
  }
  if (!input.dong) {
    errors.dong = "동(법정동)을 입력해주세요";
  }
  if (!Number.isFinite(input.areaM2) || input.areaM2 <= 0) {
    errors.areaM2 = "전용면적을 입력해주세요";
  }
  if (!Number.isFinite(input.floor) || input.floor <= 0) {
    errors.floor = "층수를 입력해주세요";
  }
  if (!Number.isFinite(input.totalFloors) || input.totalFloors <= 0) {
    errors.totalFloors = "총 층수를 입력해주세요";
  }
  if (!errors.floor && !errors.totalFloors && input.floor > input.totalFloors) {
    errors.floor = "층수는 총 층수보다 클 수 없습니다";
  }
  if (!Number.isFinite(input.rooms) || input.rooms <= 0) {
    errors.rooms = "방 개수를 입력해주세요";
  }
  return errors;
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
  const [extraUrls, setExtraUrls] = useState<string[]>(
    property?.imageUrls?.slice(1, MAX_EXTRA_PHOTOS + 1) ?? [],
  );
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [formVersion, setFormVersion] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  const handleImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      setPreviewUrl(await readFileAsDataUrl(file));
      setPhotoError(null);
    } catch {
      setPreviewUrl(property?.imageUrl);
      setPhotoError("이미지를 처리하지 못했습니다. 잠시 후 다시 시도해주세요");
    }
  };

  const handleExtraSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    if (files.length === 0) {
      return;
    }
    const remaining = MAX_EXTRA_PHOTOS - extraUrls.length;
    try {
      const urls = await Promise.all(
        files.slice(0, remaining).map(readFileAsDataUrl),
      );
      setExtraUrls((prev) => [...prev, ...urls].slice(0, MAX_EXTRA_PHOTOS));
      setPhotoError(
        files.length > remaining
          ? `추가 사진은 최대 ${MAX_EXTRA_PHOTOS}장까지 등록할 수 있어요`
          : null,
      );
    } catch {
      setPhotoError("이미지를 처리하지 못했습니다. 잠시 후 다시 시도해주세요");
    }
  };

  const handleExtraRemove = (index: number) => {
    setExtraUrls((prev) => prev.filter((_, i) => i !== index));
    setPhotoError(null);
  };

  const [formState, submitAction, isPending] = useActionState(
    async (_prev: FormState | null, formData: FormData) => {
      const values = Object.fromEntries(
        [
          "title",
          "deposit",
          "monthlyRent",
          "dong",
          "areaM2",
          "floor",
          "totalFloors",
          "rooms",
        ].map((key) => [key, String(formData.get(key) ?? "")]),
      );
      const input = {
        title: values.title.trim(),
        dealType,
        deposit: Number(values.deposit),
        monthlyRent: dealType === "월세" ? Number(values.monthlyRent) : 0,
        dong: values.dong.trim(),
        areaM2: Number(values.areaM2),
        floor: Number(values.floor),
        totalFloors: Number(values.totalFloors),
        rooms: Number(values.rooms),
      };
      const errors = validate(input);
      if (Object.keys(errors).length > 0) {
        setFormVersion((version) => version + 1);
        return { errors, values };
      }

      const imageUrl = previewUrl;
      const imageUrls = imageUrl
        ? [imageUrl, ...extraUrls]
        : extraUrls.length > 0
          ? [...extraUrls]
          : undefined;
      const next: Property = {
        ...input,
        id: property?.id ?? nextId,
        buildingType,
        region,
        saved: property?.saved ?? false,
        imageUrl,
        imageUrls,
      };
      onSave(next);
      navigate(`/properties/${next.id}`, { replace: true });
      return null;
    },
    null,
  );
  const errors = formState?.errors;
  const values = formState?.values;

  useEffect(() => {
    if (!errors) {
      return;
    }
    const invalid = formRef.current?.querySelector<HTMLElement>(
      '[aria-invalid="true"]',
    );
    if (invalid) {
      invalid.focus({ preventScroll: true });
      invalid.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [errors]);

  return (
    // key: 검증 실패 시 리마운트 — React 19 폼 리셋 후 defaultValue로 입력값을 복원하기 위함
    <form
      key={formVersion}
      ref={formRef}
      action={submitAction}
      className="flex flex-col gap-10"
    >
      <FormSection title="기본 정보">
        <FormField
          label="매물명"
          error={errors?.title}
          className="sm:col-span-2"
        >
          <Input
            name="title"
            defaultValue={values?.title ?? property?.title}
            aria-invalid={errors?.title ? true : undefined}
          />
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
        <FormField label={DEPOSIT_LABEL[dealType]} error={errors?.deposit}>
          <PriceInput
            name="deposit"
            defaultValue={values?.deposit ?? property?.deposit}
            invalid={Boolean(errors?.deposit)}
          />
        </FormField>
        <FormField
          label="월세 (만원)"
          error={errors?.monthlyRent}
          className={dealType !== "월세" ? "text-muted-foreground" : undefined}
        >
          <PriceInput
            name="monthlyRent"
            defaultValue={
              values?.monthlyRent ?? (property?.monthlyRent || undefined)
            }
            disabled={dealType !== "월세"}
            invalid={Boolean(errors?.monthlyRent)}
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
        <FormField label="동" error={errors?.dong}>
          <Input
            name="dong"
            defaultValue={values?.dong ?? property?.dong}
            aria-invalid={errors?.dong ? true : undefined}
          />
        </FormField>
      </FormSection>

      <FormSection title="상세 정보">
        <FormField label="전용면적 (㎡)" error={errors?.areaM2}>
          <Input
            name="areaM2"
            type="number"
            min={1}
            defaultValue={values?.areaM2 ?? property?.areaM2}
            aria-invalid={errors?.areaM2 ? true : undefined}
          />
        </FormField>
        <FormField label="방 개수" error={errors?.rooms}>
          <Input
            name="rooms"
            type="number"
            min={1}
            defaultValue={values?.rooms ?? property?.rooms}
            aria-invalid={errors?.rooms ? true : undefined}
          />
        </FormField>
        <FormField label="층" error={errors?.floor}>
          <Input
            name="floor"
            type="number"
            min={1}
            defaultValue={values?.floor ?? property?.floor}
            aria-invalid={errors?.floor ? true : undefined}
          />
        </FormField>
        <FormField label="총 층수" error={errors?.totalFloors}>
          <Input
            name="totalFloors"
            type="number"
            min={1}
            defaultValue={values?.totalFloors ?? property?.totalFloors}
            aria-invalid={errors?.totalFloors ? true : undefined}
          />
        </FormField>
      </FormSection>

      <FormSection title="사진">
        <PhotoField imageUrl={previewUrl} onSelect={handleImageChange} />
        <ExtraPhotoField
          urls={extraUrls}
          onSelect={handleExtraSelect}
          onRemove={handleExtraRemove}
        />
        {photoError && (
          <p className="text-xs text-destructive sm:col-span-2">{photoError}</p>
        )}
      </FormSection>

      {errors && Object.keys(errors).length > 0 && (
        <p className="text-sm text-destructive">
          입력하지 않은 항목이 있어요. 표시된 필드를 확인해주세요
        </p>
      )}

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
