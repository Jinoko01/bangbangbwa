import { RotateCcw, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PRICE_BANDS, REGIONS, ROOM_TYPES } from "@/data/properties";
import type { Filters } from "@/types";

export const DEFAULT_FILTERS: Filters = {
  query: "",
  region: "all",
  price: "all",
  buildingType: "all",
};

interface PropertyFilterBarProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

// 검색 Input + 지역·가격·유형 Select + 초기화. 상태는 부모(page)가 소유.
function PropertyFilterBar({ filters, onChange }: PropertyFilterBarProps) {
  const set = (key: keyof Filters) => (value: string) =>
    onChange({ ...filters, [key]: value });
  const isDefault =
    filters.query === "" &&
    filters.region === "all" &&
    filters.price === "all" &&
    filters.buildingType === "all";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-52 flex-1 sm:max-w-72">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="매물명·지역 검색"
          className="pl-9"
          value={filters.query}
          onChange={(e) => set("query")(e.target.value)}
        />
      </div>

      <Select value={filters.region} onValueChange={set("region")}>
        <SelectTrigger aria-label="지역 필터">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">지역 전체</SelectItem>
          {REGIONS.map((region) => (
            <SelectItem key={region} value={region}>
              {region}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.price} onValueChange={set("price")}>
        <SelectTrigger aria-label="가격 필터">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PRICE_BANDS.map((band) => (
            <SelectItem key={band.value} value={band.value}>
              {band.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.buildingType} onValueChange={set("buildingType")}>
        <SelectTrigger aria-label="유형 필터">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">유형 전체</SelectItem>
          {ROOM_TYPES.map((type) => (
            <SelectItem key={type} value={type}>
              {type}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {!isDefault && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange(DEFAULT_FILTERS)}
        >
          <RotateCcw />
          초기화
        </Button>
      )}
    </div>
  );
}

export default PropertyFilterBar;
