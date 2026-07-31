import { useState } from "react";
import { Check, ChevronDown, RotateCcw, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MONTHLY_DEPOSIT_BANDS,
  PRICE_BANDS,
  ROOM_TYPES,
} from "@/data/properties";
import { usePropertyFilterOptions } from "@/hooks/queries/propertyQueries";
import { cn } from "@/lib/utils";
import type { Filters } from "@/types";

export const DEFAULT_FILTERS: Filters = {
  query: "",
  dealType: "all",
  region: "all",
  price: "all",
  rent: "all",
  buildingType: "all",
};

interface FilterOption {
  value: string;
  label: string;
}

interface FilterField {
  key: "region" | "price" | "buildingType";
  title: string;
  options: FilterOption[];
}

const ALL_REGIONS_OPTION: FilterOption = { value: "all", label: "지역 전체" };

// 유형 선택지는 백엔드 roomType enum이 받는 값만 노출한다
const ROOM_TYPE_OPTIONS: FilterOption[] = [
  { value: "all", label: "유형 전체" },
  ...ROOM_TYPES.map((type) => ({ value: type, label: type })),
];

// 지역은 매물이 등록된 시군구만 보여준다 — 특정 지역으로 한정하지 않고 백엔드 목록을 그대로 쓴다.
// 랜딩 검색·목록 로딩 중이라 목록에 없는 지역이 선택돼 있으면 선택 상태가 보이도록 덧붙인다
function getRegionOptions(region: string, sigungus: string[]): FilterOption[] {
  const options = [
    ALL_REGIONS_OPTION,
    ...sigungus.map((sigungu) => ({ value: sigungu, label: sigungu })),
  ];
  if (region === "all" || options.some((option) => option.value === region)) {
    return options;
  }
  return [...options, { value: region, label: region }];
}

// 월세 탭에서 가격 축은 매매가가 아니라 보증금 구간이 된다
function getFilterFields(
  dealType: string,
  region: string,
  sigungus: string[],
): FilterField[] {
  const isMonthlyRent = dealType === "월세";

  return [
    {
      key: "region",
      title: "지역",
      options: getRegionOptions(region, sigungus),
    },
    {
      key: "price",
      title: isMonthlyRent ? "보증금" : "가격",
      options: isMonthlyRent ? MONTHLY_DEPOSIT_BANDS : PRICE_BANDS,
    },
    { key: "buildingType", title: "유형", options: ROOM_TYPE_OPTIONS },
  ];
}

interface FilterChipSheetProps {
  title: string;
  options: FilterOption[];
  value: string;
  onApply: (value: string) => void;
}

// 모바일 전용 — 칩을 탭하면 바텀시트에서 옵션을 고른 뒤 적용
function FilterChipSheet({
  title,
  options,
  value,
  onApply,
}: FilterChipSheetProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const selected = options.find((option) => option.value === value);
  const isActive = value !== "all";

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setDraft(value);
    }
  };

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex shrink-0 items-center gap-1 rounded-full border bg-background px-3 py-1.5 text-sm whitespace-nowrap",
            isActive && "border-primary bg-primary/5 font-medium text-primary",
          )}
        >
          {selected?.label ?? title}
          <ChevronDown className="size-3.5 opacity-60" />
        </button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-2">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={cn(
                "flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-sm",
                draft === option.value
                  ? "bg-primary/5 font-medium text-primary"
                  : "hover:bg-muted",
              )}
              onClick={() => setDraft(option.value)}
            >
              {option.label}
              {draft === option.value && <Check className="size-4" />}
            </button>
          ))}
        </div>
        <DrawerFooter>
          <Button
            size="lg"
            onClick={() => {
              onApply(draft);
              setOpen(false);
            }}
          >
            적용
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

interface PropertyFilterBarProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

// 검색 Input + 필터(sm 이상: Select 행 / 미만: 칩 + 바텀시트). 상태는 부모(page)가 소유.
function PropertyFilterBar({ filters, onChange }: PropertyFilterBarProps) {
  const { data: filterOptions } = usePropertyFilterOptions();
  const set = (key: keyof Filters) => (value: string) =>
    onChange({ ...filters, [key]: value });
  const fields = getFilterFields(
    filters.dealType,
    filters.region,
    filterOptions?.sigungus ?? [],
  );
  // dealType은 상단 세그먼트가 소유하므로 초기화 노출·대상에서 제외
  const isDefault =
    filters.query === "" &&
    fields.every((field) => filters[field.key] === "all");
  const reset = () =>
    onChange({ ...DEFAULT_FILTERS, dealType: filters.dealType });

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative sm:max-w-72 sm:min-w-52 sm:flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="매물명·지역 검색"
          className="pl-9"
          value={filters.query}
          onChange={(e) => set("query")(e.target.value)}
        />
      </div>

      <div className="hidden sm:contents">
        {fields.map((field) => (
          <Select
            key={field.key}
            value={filters[field.key]}
            onValueChange={set(field.key)}
          >
            <SelectTrigger aria-label={`${field.title} 필터`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {field.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
        {!isDefault && (
          <Button variant="ghost" size="sm" onClick={reset}>
            <RotateCcw />
            초기화
          </Button>
        )}
      </div>

      <div className="scrollbar-hidden -mx-4 flex items-center gap-2 overflow-x-auto px-4 sm:hidden">
        {fields.map((field) => (
          <FilterChipSheet
            key={field.key}
            title={field.title}
            options={field.options}
            value={filters[field.key]}
            onApply={set(field.key)}
          />
        ))}
        {!isDefault && (
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 rounded-full"
            onClick={reset}
          >
            <RotateCcw />
            초기화
          </Button>
        )}
      </div>
    </div>
  );
}

export default PropertyFilterBar;
