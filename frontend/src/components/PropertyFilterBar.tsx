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
  BUILDING_TYPES,
  MONTHLY_DEPOSIT_BANDS,
  PRICE_BANDS,
  REGIONS,
  RENT_BANDS,
} from "@/data/properties";
import { filterProperties } from "@/lib/filterProperties";
import { cn } from "@/lib/utils";
import type { Filters, Property } from "@/types";

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
  key: "region" | "price" | "rent" | "buildingType";
  title: string;
  options: FilterOption[];
}

const REGION_OPTIONS: FilterOption[] = [
  { value: "all", label: "지역 전체" },
  ...REGIONS.map((region) => ({ value: region, label: region })),
];

const BUILDING_TYPE_OPTIONS: FilterOption[] = [
  { value: "all", label: "유형 전체" },
  ...BUILDING_TYPES.map((type) => ({ value: type, label: type })),
];

// 월세 탭에서는 가격이 보증금 × 월세 2축으로 갈라진다
function getFilterFields(dealType: string): FilterField[] {
  const priceFields: FilterField[] =
    dealType === "월세"
      ? [
          { key: "price", title: "보증금", options: MONTHLY_DEPOSIT_BANDS },
          { key: "rent", title: "월세", options: RENT_BANDS },
        ]
      : [{ key: "price", title: "가격", options: PRICE_BANDS }];

  return [
    { key: "region", title: "지역", options: REGION_OPTIONS },
    ...priceFields,
    { key: "buildingType", title: "유형", options: BUILDING_TYPE_OPTIONS },
  ];
}

interface FilterChipSheetProps {
  title: string;
  options: FilterOption[];
  value: string;
  onApply: (value: string) => void;
  countWith: (value: string) => number;
}

// 모바일 전용 — 칩을 탭하면 바텀시트에서 옵션을 고르고 결과 수를 확인한 뒤 적용
function FilterChipSheet({
  title,
  options,
  value,
  onApply,
  countWith,
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
            매물 {countWith(draft)}건 보기
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

interface PropertyFilterBarProps {
  filters: Filters;
  properties: Property[];
  onChange: (filters: Filters) => void;
}

// 검색 Input + 필터(sm 이상: Select 행 / 미만: 칩 + 바텀시트). 상태는 부모(page)가 소유.
function PropertyFilterBar({
  filters,
  properties,
  onChange,
}: PropertyFilterBarProps) {
  const set = (key: keyof Filters) => (value: string) =>
    onChange({ ...filters, [key]: value });
  const fields = getFilterFields(filters.dealType);
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
            countWith={(value) =>
              filterProperties(properties, { ...filters, [field.key]: value })
                .length
            }
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
