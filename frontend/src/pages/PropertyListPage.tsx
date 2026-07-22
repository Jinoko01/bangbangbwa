import { useMemo, useState } from "react";
import { Plus, SearchX } from "lucide-react";

import PropertyCard from "@/components/PropertyCard";
import PropertyFilterBar, {
  DEFAULT_FILTERS,
} from "@/components/PropertyFilterBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PRICE_BANDS } from "@/data/properties";
import type { Property } from "@/types";

const SKELETON_COUNT = 6;

function PropertyCardSkeleton() {
  return (
    <Card className="gap-4 py-5">
      <CardHeader className="px-5">
        <div className="flex gap-1.5">
          <Skeleton className="h-5 w-11 rounded-full" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
        <Skeleton className="mt-1 h-5 w-2/3" />
      </CardHeader>
      <CardContent className="px-5">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="mt-3 h-4 w-24" />
        <Skeleton className="mt-2 h-4 w-40" />
      </CardContent>
    </Card>
  );
}

interface PropertyListPageProps {
  loading: boolean;
  properties: Property[];
  canCreate: boolean;
  onToggleSave: (id: number) => void;
  onOpen: (id: number) => void;
  onCreate: () => void;
}

// PAGE-04 매물 목록 — 목록 조회(PROP-02) 및 필터. 매물 상태는 App이 소유.
function PropertyListPage({
  loading,
  properties,
  canCreate,
  onToggleSave,
  onOpen,
  onCreate,
}: PropertyListPageProps) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  const filtered = useMemo(() => {
    const query = filters.query.trim();
    const band = PRICE_BANDS.find((b) => b.value === filters.price);
    return properties.filter((p) => {
      if (
        query &&
        ![p.title, p.region, p.dong].some((v) => v.includes(query))
      ) {
        return false;
      }
      if (filters.region !== "all" && p.region !== filters.region) {
        return false;
      }
      if (
        filters.buildingType !== "all" &&
        p.buildingType !== filters.buildingType
      ) {
        return false;
      }
      if (band && (p.deposit < band.min || p.deposit >= band.max)) {
        return false;
      }
      return true;
    });
  }, [properties, filters]);

  return (
    <div className="min-h-svh bg-background">
      <header>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6">
          <h1 className="text-lg font-semibold">매물 목록</h1>
          {canCreate && (
            <Button size="sm" onClick={onCreate}>
              <Plus />
              매물 등록
            </Button>
          )}
        </div>
      </header>

      {/* top-14: 공통 GNB(h-14) 아래에 고정 */}
      <div className="sticky top-14 z-10 border-y bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <PropertyFilterBar filters={filters} onChange={setFilters} />
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {loading ? (
          <>
            <Skeleton className="h-5 w-20" />
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: SKELETON_COUNT }, (_, i) => (
                <PropertyCardSkeleton key={i} />
              ))}
            </div>
          </>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-24 text-center">
            <SearchX className="size-10 text-muted-foreground" />
            <p className="font-medium">조건에 맞는 매물이 없습니다</p>
            <p className="text-sm text-muted-foreground">
              필터를 조정하거나 초기화해 보세요.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilters(DEFAULT_FILTERS)}
            >
              필터 초기화
            </Button>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              매물{" "}
              <span className="text-base font-semibold text-foreground">
                {filtered.length}
              </span>
              건
            </p>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((property) => (
                <PropertyCard
                  key={property.id}
                  property={property}
                  onToggleSave={onToggleSave}
                  onOpen={onOpen}
                />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default PropertyListPage;
