import { useEffect, useMemo, useRef, useState } from "react";
import { Heart, List, Map, Plus, SearchX } from "lucide-react";

import PropertyCard from "@/components/PropertyCard";
import PropertyFilterBar, {
  DEFAULT_FILTERS,
} from "@/components/PropertyFilterBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DEAL_TYPES } from "@/data/properties";
import { useIsMobile } from "@/hooks/useIsMobile";
import { filterProperties } from "@/lib/filterProperties";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Property } from "@/types";

const SKELETON_COUNT = 6;
// 모바일 레일 한 페이지(2×2)에 담을 카드 수
const RAIL_PAGE_SIZE = 4;
type ViewMode = "list" | "map";
type KakaoPoint = object;
type KakaoMap = {
  panTo: (position: KakaoPoint) => void;
  setBounds: (bounds: { extend: (position: KakaoPoint) => void }) => void;
};
type KakaoSdk = {
  load: (callback: () => void) => void;
  Map: new (
    container: HTMLElement,
    options: { center: KakaoPoint; level: number },
  ) => KakaoMap;
  LatLng: new (latitude: number, longitude: number) => KakaoPoint;
  LatLngBounds: new () => { extend: (position: KakaoPoint) => void };
  Marker: new (options: {
    map: KakaoMap;
    position: KakaoPoint;
    title: string;
  }) => object;
  event: {
    addListener: (marker: object, type: "click", handler: () => void) => void;
  };
  services: {
    Status: { OK: string };
    Geocoder: new () => {
      addressSearch: (
        address: string,
        callback: (
          result: Array<{ x: string; y: string }>,
          status: string,
        ) => void,
      ) => void;
    };
  };
};

function getKakaoMaps() {
  return (window as Window & { kakao?: { maps: KakaoSdk } }).kakao?.maps;
}

let kakaoMapLoader: Promise<void> | null = null;

function loadKakaoMap(appKey: string) {
  if (getKakaoMaps()) {
    return Promise.resolve();
  }
  if (kakaoMapLoader) {
    return kakaoMapLoader;
  }

  kakaoMapLoader = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false&libraries=services`;
    script.async = true;
    script.onload = () => getKakaoMaps()?.load(resolve);
    script.onerror = () => reject(new Error("카카오맵을 불러오지 못했습니다."));
    document.head.appendChild(script);
  });

  return kakaoMapLoader;
}

// 모바일 레일을 페이지 단위 묶음으로 나눈다
function chunkIntoPages<T>(items: T[], size: number) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, index * size + size),
  );
}

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

function PropertyCardCompactSkeleton() {
  return (
    <div>
      <Skeleton className="aspect-square w-full rounded-xl" />
      <Skeleton className="mt-2 h-4 w-full" />
      <Skeleton className="mt-1.5 h-4 w-2/3" />
      <Skeleton className="mt-2 h-5 w-24" />
    </div>
  );
}

interface PropertyCardCompactProps {
  property: Property;
  onToggleSave: (id: number) => void;
  onOpen: (id: number) => void;
}

// 모바일 목록 전용 컴팩트 카드 — 이미지 위 거래유형 뱃지·저장 버튼, 아래로 제목·가격 순
function PropertyCardCompact({
  property,
  onToggleSave,
  onOpen,
}: PropertyCardCompactProps) {
  const { title, dealType, buildingType, region, dong, saved } = property;

  return (
    <div
      className="group cursor-pointer"
      role="link"
      tabIndex={0}
      aria-label={`${title} 상세 보기`}
      onClick={() => onOpen(property.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          onOpen(property.id);
        }
      }}
    >
      <div className="relative aspect-square overflow-hidden rounded-xl bg-muted">
        <img
          src={property.imageUrl}
          alt={`${title} 매물 사진`}
          className="h-full w-full object-cover"
        />
        <Badge
          variant="secondary"
          className="absolute bottom-2 left-2 bg-background/95 font-semibold text-primary shadow-sm"
        >
          {dealType}
        </Badge>
        <button
          type="button"
          className="absolute top-2 right-2 grid size-8 place-items-center rounded-full bg-background/95 shadow-sm"
          aria-label={saved ? "매물 저장 취소" : "매물 저장"}
          aria-pressed={saved}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSave(property.id);
          }}
        >
          <Heart
            className={cn(
              "size-4",
              saved ? "fill-primary text-primary" : "text-muted-foreground",
            )}
          />
        </button>
      </div>
      <p className="mt-2 line-clamp-2 text-sm leading-snug break-keep">
        {title}
      </p>
      <p className="mt-1 font-bold text-primary">{formatPrice(property)}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {region} {dong} · {buildingType}
      </p>
    </div>
  );
}

function PropertyMap({
  properties,
  onOpen,
}: {
  properties: Property[];
  onOpen: (id: number) => void;
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState(properties[0]?.id);
  const [mapError, setMapError] = useState<string | null>(null);
  const selected =
    properties.find((property) => property.id === selectedId) ?? properties[0];
  const appKey = import.meta.env.VITE_KAKAO_KEY;

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || !appKey) {
      return;
    }

    let cancelled = false;

    loadKakaoMap(appKey)
      .then(() => {
        const maps = getKakaoMaps();
        if (cancelled || !maps) {
          return;
        }

        const map = new maps.Map(container, {
          center: new maps.LatLng(37.5665, 126.978),
          level: 8,
        });
        const geocoder = new maps.services.Geocoder();
        const bounds = new maps.LatLngBounds();

        properties.forEach((property) => {
          geocoder.addressSearch(
            `${property.region} ${property.dong}`,
            (result, status) => {
              if (
                cancelled ||
                status !== maps.services.Status.OK ||
                !result[0]
              ) {
                return;
              }

              const position = new maps.LatLng(
                Number(result[0].y),
                Number(result[0].x),
              );
              const marker = new maps.Marker({
                map,
                position,
                title: property.title,
              });

              bounds.extend(position);
              map.setBounds(bounds);

              maps.event.addListener(marker, "click", () => {
                setSelectedId(property.id);
                map.panTo(position);
              });
            },
          );
        });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setMapError(
            error instanceof Error
              ? error.message
              : "카카오맵을 불러오지 못했습니다.",
          );
        }
      });

    return () => {
      cancelled = true;
      container.replaceChildren();
    };
  }, [appKey, properties]);

  return (
    <div className="relative mt-4 h-[34rem] overflow-hidden rounded-xl border bg-muted">
      <div ref={mapContainerRef} className="absolute inset-0" />

      <div className="absolute left-4 top-4 z-10 rounded-lg bg-background/95 px-3 py-2 text-sm shadow-sm">
        지도에서 매물 {properties.length}건을 확인해 보세요
      </div>

      {(!appKey || mapError) && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center">
          <div className="rounded-xl border bg-background p-6 shadow-sm">
            <p className="font-semibold">카카오맵 설정이 필요합니다</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {mapError ?? ".env 파일에 VITE_KAKAO_KEY를 등록해 주세요."}
            </p>
          </div>
        </div>
      )}

      {selected && (
        <button
          type="button"
          className="absolute bottom-4 left-4 right-4 z-20 flex max-w-md items-center gap-3 rounded-xl border bg-background p-3 text-left shadow-md transition-shadow hover:shadow-lg sm:right-auto"
          onClick={() => onOpen(selected.id)}
        >
          <img
            src={selected.imageUrl}
            alt=""
            className="size-16 shrink-0 rounded-lg object-cover"
          />
          <span className="min-w-0">
            <span className="block truncate font-semibold">
              {selected.title}
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">
              {selected.region} {selected.dong} · {selected.buildingType}
            </span>
          </span>
        </button>
      )}
    </div>
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
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const isMobile = useIsMobile();

  const filtered = useMemo(
    () => filterProperties(properties, filters),
    [properties, filters],
  );

  // 거래유형이 바뀌면 가격 축 의미가 달라지므로 가격·월세 구간을 초기화
  const handleDealTypeChange = (dealType: string) =>
    setFilters({ ...filters, dealType, price: "all", rent: "all" });

  return (
    <div className="min-h-svh bg-background">
      <header>
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-6">
          <div className="flex w-full items-center justify-between">
            <h1 className="text-lg font-semibold">매물 목록</h1>
            {canCreate && (
              <Button size="sm" onClick={onCreate}>
                <Plus />
                매물 등록
              </Button>
            )}
          </div>
          <div
            className="inline-flex rounded-xl border bg-muted p-1.5 shadow-sm"
            role="tablist"
            aria-label="매물 보기 방식"
          >
            <Button
              type="button"
              role="tab"
              size="default"
              variant={viewMode === "list" ? "default" : "ghost"}
              className="min-w-28 rounded-lg font-semibold"
              aria-selected={viewMode === "list"}
              onClick={() => setViewMode("list")}
            >
              <List /> 리스트형식
            </Button>
            <Button
              type="button"
              role="tab"
              size="default"
              variant={viewMode === "map" ? "default" : "ghost"}
              className="min-w-28 rounded-lg font-semibold"
              aria-selected={viewMode === "map"}
              onClick={() => setViewMode("map")}
            >
              <Map /> 지도형식
            </Button>
          </div>
        </div>
      </header>

      {/* top-14: 공통 GNB(h-14) 아래에 고정 */}
      <div className="sticky top-14 z-10 border-y bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3">
          <div
            className="scrollbar-hidden -mx-4 flex items-center gap-1 overflow-x-auto px-4 sm:hidden"
            role="tablist"
            aria-label="거래유형 필터"
          >
            {["all", ...DEAL_TYPES].map((dealType) => {
              const isActive = filters.dealType === dealType;
              return (
                <button
                  key={dealType}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={cn(
                    "shrink-0 rounded-full px-4 py-1.5 text-sm whitespace-nowrap transition-colors",
                    isActive
                      ? "bg-foreground font-semibold text-background"
                      : "font-medium text-muted-foreground",
                  )}
                  onClick={() => handleDealTypeChange(dealType)}
                >
                  {dealType === "all" ? "전체" : dealType}
                </button>
              );
            })}
          </div>
          <Tabs
            value={filters.dealType}
            onValueChange={handleDealTypeChange}
            className="hidden sm:block"
          >
            <TabsList className="w-fit" aria-label="거래유형 필터">
              <TabsTrigger value="all" className="sm:min-w-20">
                전체
              </TabsTrigger>
              {DEAL_TYPES.map((dealType) => (
                <TabsTrigger
                  key={dealType}
                  value={dealType}
                  className="sm:min-w-20"
                >
                  {dealType}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <PropertyFilterBar
            filters={filters}
            properties={properties}
            onChange={setFilters}
          />
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {loading ? (
          <>
            <Skeleton className="h-5 w-20" />
            {isMobile ? (
              <div className="-mx-4 mt-4 flex gap-3 overflow-x-auto px-4 pb-2">
                {chunkIntoPages(
                  Array.from({ length: SKELETON_COUNT }, (_, i) => i),
                  RAIL_PAGE_SIZE,
                ).map((pageIndexes) => (
                  <div
                    key={pageIndexes[0]}
                    className="grid w-[92%] shrink-0 grid-cols-2 gap-3"
                  >
                    {pageIndexes.map((i) => (
                      <PropertyCardCompactSkeleton key={i} />
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: SKELETON_COUNT }, (_, i) => (
                  <PropertyCardSkeleton key={i} />
                ))}
              </div>
            )}
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
            {viewMode === "list" ? (
              isMobile ? (
                // 2×2 카드 페이지를 가로로 스와이프하는 레일 — 카드가 왼쪽 위부터 가로 순서로 채워진다.
                // 필터가 바뀌면 key로 리마운트해 첫 매물부터 다시 보여준다
                <div
                  key={JSON.stringify(filters)}
                  className="-mx-4 mt-4 flex snap-x scroll-pl-4 gap-3 overflow-x-auto px-4 pb-2"
                  role="tabpanel"
                >
                  {chunkIntoPages(filtered, RAIL_PAGE_SIZE).map(
                    (pageProperties) => (
                      <div
                        key={pageProperties[0].id}
                        className="grid w-[92%] shrink-0 snap-start grid-cols-2 gap-3"
                      >
                        {pageProperties.map((property) => (
                          <PropertyCardCompact
                            key={property.id}
                            property={property}
                            onToggleSave={onToggleSave}
                            onOpen={onOpen}
                          />
                        ))}
                      </div>
                    ),
                  )}
                </div>
              ) : (
                <div
                  className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                  role="tabpanel"
                >
                  {filtered.map((property) => (
                    <PropertyCard
                      key={property.id}
                      property={property}
                      onToggleSave={onToggleSave}
                      onOpen={onOpen}
                    />
                  ))}
                </div>
              )
            ) : (
              <div role="tabpanel">
                <PropertyMap properties={filtered} onOpen={onOpen} />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default PropertyListPage;
