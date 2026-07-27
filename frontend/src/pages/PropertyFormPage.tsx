import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type ReactNode,
} from "react";
import {
  Navigate,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  ChevronLeft,
  ImageIcon,
  ImagePlus,
  MapPin,
  TrainFront,
  X,
} from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import { ROOM_TYPES } from "@/data/properties";
import { isApiError } from "@/api/error";
import { useCreateProperty } from "@/hooks/queries/propertyQueries";
import { isApprovedBroker } from "@/lib/auth";
import { readFileAsDataUrl } from "@/lib/file";
import { formatManwonLabel } from "@/lib/format";
import {
  searchAddress,
  searchPropertyEnvironment,
  type GeocodedAddress,
} from "@/lib/kakaoLocal";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import type {
  DealType,
  Property,
  PropertyCreateInput,
  PropertyEnvironment,
  RoomType,
} from "@/types";

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
  required,
  error,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-2 text-sm font-medium", className)}>
      <span>
        {label}
        {required && (
          <span aria-hidden className="ml-0.5 text-destructive">
            *
          </span>
        )}
      </span>
      {children}
      {error && (
        <span className="text-xs font-normal text-destructive">{error}</span>
      )}
    </label>
  );
}

// 주소 검색 — 카카오 좌표 변환으로 위도·경도와 시군구·동·지번·도로명 주소를 한 번에 채운다.
// 등록 요청의 latitude·longitude는 이 검색 결과에서만 나온다 (직접 입력 불가)
function AddressField({
  query,
  resolved,
  error,
  onQueryChange,
  onResolve,
}: {
  query: string;
  resolved: GeocodedAddress | null;
  error?: string;
  onQueryChange: (query: string) => void;
  onResolve: (address: GeocodedAddress | null) => void;
}) {
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, startSearch] = useTransition();

  const search = () => {
    const trimmed = query.trim();
    if (!trimmed) {
      onResolve(null);
      setSearchError("주소를 입력해주세요");
      return;
    }
    startSearch(async () => {
      try {
        onResolve(await searchAddress(trimmed));
        setSearchError(null);
      } catch (failure) {
        onResolve(null);
        setSearchError(
          failure instanceof Error
            ? failure.message
            : "주소를 검색하지 못했습니다. 잠시 후 다시 시도해주세요",
        );
      }
    });
  };

  const message = searchError ?? error;

  return (
    <div className="flex flex-col gap-2 text-sm font-medium sm:col-span-2">
      <label htmlFor="address">
        주소
        <span aria-hidden className="ml-0.5 text-destructive">
          *
        </span>
      </label>
      <div className="flex gap-2">
        <Input
          id="address"
          value={query}
          placeholder="예) 서울 강남구 테헤란로 212"
          aria-invalid={message ? true : undefined}
          onChange={(event) => {
            onQueryChange(event.target.value);
            // 주소가 바뀌면 이전 좌표는 더 이상 유효하지 않다
            onResolve(null);
            setSearchError(null);
          }}
          onKeyDown={(event) => {
            // 주소 입력 중 Enter가 폼 전체를 제출하지 않도록 검색으로 대체
            if (event.key === "Enter") {
              event.preventDefault();
              search();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={isSearching}
          onClick={search}
        >
          {isSearching ? "검색 중..." : "주소 검색"}
        </Button>
      </div>
      {resolved && (
        <span className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" />
          {resolved.roadAddress || resolved.addressName} · 위도{" "}
          {resolved.latitude.toFixed(6)} / 경도 {resolved.longitude.toFixed(6)}
        </span>
      )}
      {message && (
        <span className="text-xs font-normal text-destructive">{message}</span>
      )}
    </div>
  );
}

// property_environment의 개수 항목 — 표시 순서와 라벨
const FACILITY_COUNT_LABELS: Array<[keyof PropertyEnvironment, string]> = [
  ["convenienceStoreCount", "편의점"],
  ["martCount", "마트"],
  ["hospitalCount", "병원"],
  ["pharmacyCount", "약국"],
  ["cafeCount", "카페"],
  ["policeCount", "경찰서"],
  ["parkCount", "공원"],
  ["bankCount", "은행"],
  ["laundryCount", "빨래방"],
  ["schoolCount", "학교"],
];

// 주변 편의시설 — 주소 검색으로 좌표가 잡히면 카카오 장소 검색으로 자동 집계된다
function EnvironmentSection({
  environment,
  isLoading,
  error,
  hasAddress,
  onRetry,
}: {
  environment: PropertyEnvironment | null;
  isLoading: boolean;
  error: string | null;
  hasAddress: boolean;
  onRetry: () => void;
}) {
  if (!hasAddress) {
    return (
      <p className="text-sm font-normal text-muted-foreground sm:col-span-2">
        주소를 검색하면 반경 500m 안의 편의시설과 가장 가까운 지하철역을
        자동으로 가져옵니다.
      </p>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 sm:col-span-2">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 sm:col-span-2">
        <p className="text-sm font-normal text-destructive">{error}</p>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          다시 시도
        </Button>
      </div>
    );
  }

  if (!environment) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4 sm:col-span-2">
      <p className="flex items-center gap-1.5 text-sm font-normal">
        <TrainFront className="size-4 shrink-0 text-muted-foreground" />
        {environment.nearestStationName ? (
          <span>
            <span className="font-medium">
              {environment.nearestStationName}
            </span>{" "}
            <span className="text-muted-foreground">
              {environment.stationDistanceMeter}m · 도보{" "}
              {environment.stationWalkingMinutes}분
            </span>
          </span>
        ) : (
          <span className="text-muted-foreground">
            반경 3km 안에 지하철역이 없습니다
          </span>
        )}
      </p>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {FACILITY_COUNT_LABELS.map(([field, label]) => (
          <div
            key={field}
            className="flex items-baseline justify-between gap-2 rounded-xl bg-muted px-3 py-2"
          >
            <dt className="text-xs font-normal text-muted-foreground">
              {label}
            </dt>
            <dd className="text-sm font-semibold">{environment[field] ?? 0}</dd>
          </div>
        ))}
      </dl>
    </div>
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
  brokerId: number;
  onSave: (property: Property) => void;
}

interface FormInput {
  title: string;
  dealType: DealType;
  deposit: number;
  monthlyRent: number;
  maintenanceFee?: number;
  complexName: string;
  builtYear?: number;
  description: string;
  areaM2: number;
  floor: number;
  totalFloors?: number;
  rooms: number;
}

function validate(input: FormInput, address: GeocodedAddress | null) {
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
  if (!address) {
    errors.address = "주소를 검색해 위치를 확인해주세요";
  } else if (!address.sigungu || !address.dong) {
    errors.address = "동 단위까지 포함된 주소로 다시 검색해주세요";
  }
  if (
    input.builtYear !== undefined &&
    (!Number.isInteger(input.builtYear) ||
      input.builtYear < 1900 ||
      input.builtYear > 2100)
  ) {
    errors.builtYear = "준공 연도를 1900~2100 사이로 입력해주세요";
  }
  if (
    input.maintenanceFee !== undefined &&
    (!Number.isFinite(input.maintenanceFee) || input.maintenanceFee < 0)
  ) {
    errors.maintenanceFee = "관리비를 올바르게 입력해주세요";
  }
  if (!Number.isFinite(input.areaM2) || input.areaM2 <= 0) {
    errors.areaM2 = "전용면적을 입력해주세요";
  }
  if (!Number.isFinite(input.floor) || input.floor <= 0) {
    errors.floor = "층수를 입력해주세요";
  }
  if (
    input.totalFloors !== undefined &&
    (!Number.isFinite(input.totalFloors) || input.totalFloors <= 0)
  ) {
    errors.totalFloors = "총 층수를 올바르게 입력해주세요";
  }
  if (
    !errors.floor &&
    !errors.totalFloors &&
    input.totalFloors !== undefined &&
    input.floor > input.totalFloors
  ) {
    errors.floor = "층수는 총 층수보다 클 수 없습니다";
  }
  if (!Number.isFinite(input.rooms) || input.rooms <= 0) {
    errors.rooms = "방 개수를 입력해주세요";
  }
  return errors;
}

function PropertyForm({
  property,
  nextId,
  brokerId,
  onSave,
}: PropertyFormProps) {
  const navigate = useNavigate();
  const { mutateAsync: createProperty } = useCreateProperty();
  const [dealType, setDealType] = useState<DealType>(
    property?.dealType ?? "전세",
  );
  const [roomType, setRoomType] = useState<RoomType>(
    // 목데이터의 "아파트"는 백엔드 enum에 없어 등록 가능한 유형으로 대체한다
    property && property.buildingType !== "아파트"
      ? property.buildingType
      : ROOM_TYPES[0],
  );
  const [address, setAddress] = useState<GeocodedAddress | null>(null);
  // 검증 실패 시 폼이 리마운트되므로 주소 입력값은 폼 바깥에서 보관한다
  const [addressQuery, setAddressQuery] = useState(
    property ? `${property.region} ${property.dong}` : "",
  );
  const [environment, setEnvironment] = useState<PropertyEnvironment | null>(
    null,
  );
  const [environmentError, setEnvironmentError] = useState<string | null>(null);
  const [isLoadingEnvironment, startEnvironmentLoad] = useTransition();
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

  const loadEnvironment = (resolved: GeocodedAddress) => {
    startEnvironmentLoad(async () => {
      try {
        setEnvironment(await searchPropertyEnvironment(resolved));
        setEnvironmentError(null);
      } catch {
        setEnvironment(null);
        setEnvironmentError(
          "주변 편의시설 정보를 가져오지 못했습니다. 다시 시도해주세요",
        );
      }
    });
  };

  // 주소가 확정되면 좌표 기준으로 주변 편의시설을 함께 조회한다
  const handleAddressResolve = (resolved: GeocodedAddress | null) => {
    setAddress(resolved);
    setEnvironment(null);
    setEnvironmentError(null);
    if (resolved) {
      loadEnvironment(resolved);
    }
  };

  // 등록: POST /api/properties — 좌표는 주소 검색 결과에서 가져온다
  const submitCreate = async (input: FormInput, resolved: GeocodedAddress) => {
    const body: PropertyCreateInput = {
      title: input.title,
      transactionType: input.dealType,
      roomType,
      deposit: input.deposit,
      monthlyRent: input.monthlyRent,
      maintenanceFee: input.maintenanceFee,
      sigungu: resolved.sigungu,
      dong: resolved.dong,
      lotNumber: resolved.lotNumber || undefined,
      roadAddress: resolved.roadAddress || undefined,
      complexName: input.complexName || undefined,
      builtYear: input.builtYear,
      latitude: resolved.latitude,
      longitude: resolved.longitude,
      area: input.areaM2,
      floor: input.floor,
      totalFloor: input.totalFloors,
      description: input.description || undefined,
    };
    await createProperty(body);
  };

  // 수정: 백엔드에 매물 수정 API가 없어 아직 로컬 상태만 갱신한다
  const saveLocally = (input: FormInput, resolved: GeocodedAddress) => {
    const imageUrl = previewUrl;
    const imageUrls = imageUrl
      ? [imageUrl, ...extraUrls]
      : extraUrls.length > 0
        ? [...extraUrls]
        : undefined;
    onSave({
      id: property?.id ?? nextId,
      brokerId,
      title: input.title,
      dealType: input.dealType,
      buildingType: roomType,
      deposit: input.deposit,
      monthlyRent: input.monthlyRent,
      region: resolved.sigungu,
      dong: resolved.dong,
      areaM2: input.areaM2,
      floor: input.floor,
      totalFloors: input.totalFloors,
      rooms: input.rooms,
      saved: property?.saved ?? false,
      imageUrl,
      imageUrls,
    });
  };

  const [formState, submitAction, isPending] = useActionState(
    async (_prev: FormState | null, formData: FormData) => {
      const values = Object.fromEntries(
        [
          "title",
          "deposit",
          "monthlyRent",
          "maintenanceFee",
          "complexName",
          "builtYear",
          "description",
          "areaM2",
          "floor",
          "totalFloors",
          "rooms",
        ].map((key) => [key, String(formData.get(key) ?? "")]),
      );
      const input: FormInput = {
        title: values.title.trim(),
        dealType,
        deposit: Number(values.deposit),
        monthlyRent: dealType === "월세" ? Number(values.monthlyRent) : 0,
        maintenanceFee: values.maintenanceFee
          ? Number(values.maintenanceFee)
          : undefined,
        complexName: values.complexName.trim(),
        builtYear: values.builtYear ? Number(values.builtYear) : undefined,
        description: values.description.trim(),
        areaM2: Number(values.areaM2),
        floor: Number(values.floor),
        totalFloors: values.totalFloors
          ? Number(values.totalFloors)
          : undefined,
        rooms: Number(values.rooms),
      };
      const errors = validate(input, address);
      if (Object.keys(errors).length > 0) {
        setFormVersion((version) => version + 1);
        return { errors, values };
      }
      // validate가 address를 검증했으므로 여기서는 항상 값이 있다
      const resolved = address as GeocodedAddress;

      try {
        if (property) {
          saveLocally(input, resolved);
          navigate(`/properties/${property.id}`, { replace: true });
        } else {
          await submitCreate(input, resolved);
          navigate("/properties", { replace: true });
        }
        return null;
      } catch (failure) {
        setFormVersion((version) => version + 1);
        return {
          errors: {
            submit: isApiError(failure)
              ? failure.message
              : "매물을 등록하지 못했습니다. 잠시 후 다시 시도해주세요",
          },
          values,
        };
      }
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
      <p className="-mb-6 text-xs text-muted-foreground">
        <span aria-hidden className="text-destructive">
          *
        </span>{" "}
        표시는 필수 입력 항목입니다
      </p>
      <FormSection title="기본 정보">
        <FormField
          label="매물명"
          required
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
            value={roomType}
            onValueChange={(value) => setRoomType(value as RoomType)}
          >
            <SelectTrigger aria-label="건물 유형" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROOM_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField
          label={DEPOSIT_LABEL[dealType]}
          required
          error={errors?.deposit}
        >
          <PriceInput
            name="deposit"
            defaultValue={values?.deposit ?? property?.deposit}
            invalid={Boolean(errors?.deposit)}
          />
        </FormField>
        <FormField
          label="월세 (만원)"
          required={dealType === "월세"}
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
        <AddressField
          query={addressQuery}
          resolved={address}
          error={errors?.address}
          onQueryChange={setAddressQuery}
          onResolve={handleAddressResolve}
        />
        {address && (
          <>
            <FormField label="시군구">
              <Input value={address.sigungu} readOnly disabled />
            </FormField>
            <FormField label="동 (법정동)">
              <Input value={address.dong} readOnly disabled />
            </FormField>
            <FormField label="지번">
              <Input value={address.lotNumber || "-"} readOnly disabled />
            </FormField>
          </>
        )}
        <FormField label="단지·건물명">
          <Input
            name="complexName"
            defaultValue={values?.complexName}
            placeholder="예) 래미안 1단지"
          />
        </FormField>
        <FormField label="준공 연도" error={errors?.builtYear}>
          <Input
            name="builtYear"
            type="number"
            min={1900}
            max={2100}
            defaultValue={values?.builtYear}
            aria-invalid={errors?.builtYear ? true : undefined}
          />
        </FormField>
      </FormSection>

      <FormSection title="주변 편의시설">
        <EnvironmentSection
          environment={environment}
          isLoading={isLoadingEnvironment}
          error={environmentError}
          hasAddress={address !== null}
          onRetry={() => address && loadEnvironment(address)}
        />
      </FormSection>

      <FormSection title="상세 정보">
        <FormField label="전용면적 (㎡)" required error={errors?.areaM2}>
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
        <FormField label="층" required error={errors?.floor}>
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
        <FormField label="관리비 (만원)" error={errors?.maintenanceFee}>
          <PriceInput
            name="maintenanceFee"
            defaultValue={values?.maintenanceFee}
            invalid={Boolean(errors?.maintenanceFee)}
          />
        </FormField>
        <FormField label="상세 설명" className="sm:col-span-2">
          <Textarea
            name="description"
            rows={4}
            defaultValue={values?.description}
            placeholder="채광·옵션·주변 환경 등 세입자가 궁금해할 정보를 적어주세요"
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

      {errors?.submit ? (
        <p className="text-sm text-destructive">{errors.submit}</p>
      ) : (
        errors &&
        Object.keys(errors).length > 0 && (
          <p className="text-sm text-destructive">
            입력하지 않은 항목이 있어요. 표시된 필드를 확인해주세요
          </p>
        )
      )}

      <div className="flex items-center justify-between gap-4 border-t pt-4">
        <p className="text-sm text-muted-foreground">
          {property
            ? "저장하면 매물 목록·상세에 바로 반영됩니다."
            : "등록하면 서버에 매물이 저장됩니다."}
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
// 수정은 본인이 등록한 매물만 가능 — 남의 매물 URL로 진입하면 상세로 돌려보낸다
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
  if (property && property.brokerId !== user.id) {
    return <Navigate to={`/properties/${property.id}`} replace />;
  }
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
          <PropertyForm
            property={property}
            nextId={nextId}
            brokerId={property?.brokerId ?? user.id}
            onSave={onSave}
          />
        )}
      </main>
    </div>
  );
}

export default PropertyFormPage;
