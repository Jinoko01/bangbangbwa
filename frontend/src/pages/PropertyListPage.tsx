import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Heart, ImageIcon, List, Map, Plus, SearchX } from "lucide-react";

import PropertyCard, {
  toPropertyCardItem,
  type PropertyCardItem,
} from "@/components/PropertyCard";
import PropertyFilterBar, {
  DEFAULT_FILTERS,
} from "@/components/PropertyFilterBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DEAL_TYPES,
  MONTHLY_DEPOSIT_BANDS,
  PRICE_BANDS,
} from "@/data/properties";
import {
  usePropertyList,
  useToggleSavedInCache,
} from "@/hooks/queries/propertyQueries";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useIsMobile } from "@/hooks/useIsMobile";
import { formatPrice } from "@/lib/format";
import { parseRegionQuery } from "@/lib/regionSearch";
import { cn } from "@/lib/utils";
import type { DealType, Filters, PropertyFilters, RoomType } from "@/types";

const SKELETON_COUNT = 6;
const PAGE_SIZE = 12;
// 모바일 레일 한 페이지(2×2)에 담을 카드 수
const RAIL_PAGE_SIZE = 4;
type ViewMode = "list" | "map";
type KakaoPoint = object;
type KakaoMap = {
  panTo: (position: KakaoPoint) => void;
  setBounds: (bounds: { extend: (position: KakaoPoint) => void }) => void;
};
type KakaoMarker = object;
type KakaoCluster = {
  getMarkers: () => KakaoMarker[];
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
    map?: KakaoMap;
    position: KakaoPoint;
    title: string;
  }) => KakaoMarker;
  MarkerClusterer: new (options: {
    map: KakaoMap;
    markers: KakaoMarker[];
    averageCenter: boolean;
    minLevel: number;
    disableClickZoom: boolean;
    clickable: boolean;
    styles: Array<Record<string, string>>;
  }) => object;
  event: {
    addListener: (
      target: object,
      type: "click" | "clusterclick",
      handler: (cluster?: KakaoCluster) => void,
    ) => void;
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
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false&libraries=services,clusterer`;
    script.async = true;
    script.onload = () => getKakaoMaps()?.load(resolve);
    script.onerror = () => reject(new Error("카카오맵을 불러오지 못했습니다."));
    document.head.appendChild(script);
  });

  return kakaoMapLoader;
}

const CLUSTER_STYLES = [
  {
    width: "48px",
    height: "48px",
    background: "#1677ff",
    borderRadius: "50%",
    color: "#fff",
    fontSize: "15px",
    fontWeight: "700",
    lineHeight: "48px",
    textAlign: "center",
    boxShadow: "0 3px 12px rgba(22, 119, 255, 0.38)",
  },
];

function spreadOverlappingPosition(
  latitude: number,
  longitude: number,
  overlapIndex: number,
) {
  if (overlapIndex === 0) {
    return { latitude, longitude };
  }

  const angle = overlapIndex * 2.399963;
  const radius = 0.00045 * Math.sqrt(overlapIndex);
  const longitudeScale = Math.max(Math.cos((latitude * Math.PI) / 180), 0.2);

  return {
    latitude: latitude + Math.sin(angle) * radius,
    longitude: longitude + (Math.cos(angle) * radius) / longitudeScale,
  };
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
  property: PropertyCardItem;
  onToggleSave: (id: number) => void;
  onOpen: (id: number) => void;
}

// 모바일 목록 전용 컴팩트 카드 — 이미지 위 거래유형 뱃지·저장 버튼, 아래로 제목·가격 순
function PropertyCardCompact({
  property,
  onToggleSave,
  onOpen,
}: PropertyCardCompactProps) {
  const { title, dealType, roomType, region, dong, imageUrl, saved } = property;

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
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`${title} 매물 사진`}
            className="h-full w-full object-cover"
          />
        ) : (
          <span aria-hidden className="grid h-full w-full place-items-center">
            <ImageIcon className="size-6 text-muted-foreground" />
          </span>
        )}
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
        {region} {dong} · {roomType}
      </p>
    </div>
  );
}

function PropertyMap({
  properties,
  onOpen,
}: {
  properties: PropertyCardItem[];
  onOpen: (id: number) => void;
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<number | undefined>(
    properties[0]?.id,
  );
  const [clusterResults, setClusterResults] = useState<PropertyCardItem[]>([]);
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
        const propertyByMarker = new globalThis.Map<
          KakaoMarker,
          PropertyCardItem
        >();
        const addressOccurrences = new globalThis.Map<string, number>();
        setClusterResults([]);

        const markerPromises = properties.map((property) => {
          const address = `${property.region} ${property.dong}`;
          const overlapIndex = addressOccurrences.get(address) ?? 0;
          addressOccurrences.set(address, overlapIndex + 1);

          return new Promise<KakaoMarker | null>((resolve) => {
            geocoder.addressSearch(address, (result, status) => {
              if (
                cancelled ||
                status !== maps.services.Status.OK ||
                !result[0]
              ) {
                resolve(null);
                return;
              }

              const spreadPosition = spreadOverlappingPosition(
                Number(result[0].y),
                Number(result[0].x),
                overlapIndex,
              );
              const position = new maps.LatLng(
                spreadPosition.latitude,
                spreadPosition.longitude,
              );
              const marker = new maps.Marker({
                position,
                title: property.title,
              });

              propertyByMarker.set(marker, property);
              bounds.extend(position);
              maps.event.addListener(marker, "click", () => {
                setClusterResults([]);
                setSelectedId(property.id);
                map.panTo(position);
              });
              resolve(marker);
            });
          });
        });

        Promise.all(markerPromises).then((results) => {
          if (cancelled) {
            return;
          }

          const markers = results.filter(
            (marker): marker is KakaoMarker => marker !== null,
          );
          if (markers.length === 0) {
            return;
          }

          const clusterer = new maps.MarkerClusterer({
            map,
            markers,
            averageCenter: true,
            minLevel: 6,
            disableClickZoom: true,
            clickable: true,
            styles: CLUSTER_STYLES,
          });

          maps.event.addListener(clusterer, "clusterclick", (cluster) => {
            if (!cluster) {
              return;
            }

            const clusterItems = cluster
              .getMarkers()
              .map((marker) => propertyByMarker.get(marker))
              .filter(
                (property): property is PropertyCardItem =>
                  property !== undefined,
              );

            setSelectedId(undefined);
            setClusterResults(clusterItems);
          });
          map.setBounds(bounds);
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
              {mapError ??
                "예상치 못한 에러가 발생했습니다. 관리자에게 문의해 주세요."}
            </p>
          </div>
        </div>
      )}

      {clusterResults.length > 0 ? (
        <section className="absolute inset-x-4 bottom-4 z-20 max-h-[60%] overflow-hidden rounded-xl border bg-background shadow-md sm:right-auto sm:w-96">
          <div className="border-b px-4 py-3">
            <p className="font-semibold">
              이 지역 매물 {clusterResults.length}건
            </p>
          </div>
          <div className="max-h-[22rem] overflow-y-auto p-2">
            {clusterResults.map((property) => (
              <button
                key={property.id}
                type="button"
                className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-muted"
                onClick={() => onOpen(property.id)}
              >
                {property.imageUrl ? (
                  <img
                    src={property.imageUrl}
                    alt=""
                    className="size-16 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <span className="grid size-16 shrink-0 place-items-center rounded-lg bg-muted">
                    <ImageIcon className="size-5 text-muted-foreground" />
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate font-semibold">
                    {property.title}
                  </span>
                  <span className="mt-1 block font-semibold text-primary">
                    {formatPrice(property)}
                  </span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">
                    {property.region} {property.dong} · {property.roomType}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : selected ? (
        <button
          type="button"
          className="absolute bottom-4 left-4 right-4 z-20 flex max-w-md items-center gap-3 rounded-xl border bg-background p-3 text-left shadow-md transition-shadow hover:shadow-lg sm:right-auto"
          onClick={() => onOpen(selected.id)}
        >
          {selected.imageUrl ? (
            <img
              src={selected.imageUrl}
              alt=""
              className="size-16 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <span
              aria-hidden
              className="grid size-16 shrink-0 place-items-center rounded-lg bg-muted"
            >
              <ImageIcon className="size-5 text-muted-foreground" />
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate font-semibold">
              {selected.title}
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">
              {selected.region} {selected.dong} · {selected.roomType}
            </span>
          </span>
        </button>
      ) : null}
    </div>
  );
}

// 화면 필터 → 매물 목록 API 쿼리 파라미터 (선택하지 않은 값은 보내지 않는다)
// 월세 탭의 가격 축은 보증금 구간이라 밴드 목록이 갈린다.
// "서울시 강남구 역삼동" 같은 검색어는 구 필터와 나머지 검색어로 분리하되,
// 지역 셀렉트를 직접 골랐다면 그 선택이 우선한다
function toQueryFilters(filters: Filters, query: string): PropertyFilters {
  const bands =
    filters.dealType === "월세" ? MONTHLY_DEPOSIT_BANDS : PRICE_BANDS;
  const band = bands.find((b) => b.value === filters.price);
  const parsed = parseRegionQuery(query);

  return {
    query: parsed.query,
    transactionType:
      filters.dealType === "all" ? undefined : (filters.dealType as DealType),
    sigungu: filters.region === "all" ? parsed.sigungu : filters.region,
    roomType:
      filters.buildingType === "all"
        ? undefined
        : (filters.buildingType as RoomType),
    minDeposit: band && band.min > 0 ? band.min : undefined,
    maxDeposit: band && Number.isFinite(band.max) ? band.max : undefined,
  };
}

interface PropertyListPageProps {
  canCreate: boolean;
  onOpen: (id: number) => void;
  onCreate: () => void;
}

// PAGE-04 매물 목록 — 목록 조회(PROP-02) 및 필터. 검색·필터·페이지는 서버(GET /api/properties)가 처리한다.
function PropertyListPage({
  canCreate,
  onOpen,
  onCreate,
}: PropertyListPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  // 랜딩 히어로 검색이 넘긴 초기 조건(?sigungu=&query=) — 이후 변경은 필터바 상태가 소유한다
  const [filters, setFilters] = useState(() => ({
    ...DEFAULT_FILTERS,
    region: searchParams.get("sigungu") ?? DEFAULT_FILTERS.region,
    query: searchParams.get("query") ?? DEFAULT_FILTERS.query,
  }));
  const [page, setPage] = useState(0);
  // 탭은 URL 쿼리(?view=map)로 관리 — 상세에서 뒤로 왔을 때 지도/리스트 선택이 유지된다
  const viewMode: ViewMode =
    searchParams.get("view") === "map" ? "map" : "list";
  const isMobile = useIsMobile();
  const debouncedQuery = useDebouncedValue(filters.query.trim());
  const toggleSaved = useToggleSavedInCache();

  const queryFilters = useMemo(
    () => toQueryFilters(filters, debouncedQuery),
    [filters, debouncedQuery],
  );
  const { data, isPending, isError, refetch } = usePropertyList(queryFilters, {
    page,
    size: PAGE_SIZE,
  });
  const items = useMemo(
    () => data?.content.map(toPropertyCardItem) ?? [],
    [data],
  );

  const changeFilters = (next: Filters) => {
    setFilters(next);
    setPage(0);
  };

  // 거래유형이 바뀌면 가격 축 의미가 달라지므로 가격 구간을 초기화
  const handleDealTypeChange = (dealType: string) =>
    changeFilters({ ...filters, dealType, price: "all", rent: "all" });

  // 탭 전환은 히스토리를 쌓지 않는다(replace) — 뒤로가기는 항상 페이지 이탈
  const changeViewMode = (next: ViewMode) => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next === "map") {
          params.set("view", "map");
        } else {
          params.delete("view");
        }
        return params;
      },
      { replace: true },
    );
  };

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
              onClick={() => changeViewMode("list")}
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
              onClick={() => changeViewMode("map")}
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
          <PropertyFilterBar filters={filters} onChange={changeFilters} />
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {isPending ? (
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
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 py-24 text-center">
            <p className="font-medium">매물 목록을 불러오지 못했습니다</p>
            <p className="text-sm text-muted-foreground">
              잠시 후 다시 시도해 주세요.
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              다시 시도
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-24 text-center">
            <SearchX className="size-10 text-muted-foreground" />
            <p className="font-medium">조건에 맞는 매물이 없습니다</p>
            <p className="text-sm text-muted-foreground">
              필터를 조정하거나 초기화해 보세요.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => changeFilters(DEFAULT_FILTERS)}
            >
              필터 초기화
            </Button>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              매물{" "}
              <span className="text-base font-semibold text-foreground">
                {data.totalElements}
              </span>
              건
            </p>
            {viewMode === "list" ? (
              isMobile ? (
                // 2×2 카드 페이지를 가로로 스와이프하는 레일 — 카드가 왼쪽 위부터 가로 순서로 채워진다.
                // 조회 조건이 바뀌면 key로 리마운트해 첫 매물부터 다시 보여준다
                <div
                  key={`${JSON.stringify(queryFilters)}-${page}`}
                  className="-mx-4 mt-4 flex snap-x scroll-pl-4 gap-3 overflow-x-auto px-4 pb-2"
                  role="tabpanel"
                >
                  {chunkIntoPages(items, RAIL_PAGE_SIZE).map(
                    (pageProperties) => (
                      <div
                        key={pageProperties[0].id}
                        className="grid w-[92%] shrink-0 snap-start grid-cols-2 gap-3"
                      >
                        {pageProperties.map((property) => (
                          <PropertyCardCompact
                            key={property.id}
                            property={property}
                            onToggleSave={toggleSaved}
                            onOpen={onOpen}
                          />
                        ))}
                      </div>
                    ),
                  )}
                </div>
              ) : (
                <div
                  className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
                  role="tabpanel"
                >
                  {items.map((property) => (
                    <PropertyCard
                      key={property.id}
                      property={property}
                      onToggleSave={toggleSaved}
                      onOpen={onOpen}
                    />
                  ))}
                </div>
              )
            ) : (
              <div role="tabpanel">
                <PropertyMap properties={items} onOpen={onOpen} />
              </div>
            )}
            {data.totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={data.first}
                  onClick={() => setPage((current) => current - 1)}
                >
                  이전
                </Button>
                <span className="text-sm text-muted-foreground">
                  {data.number + 1} / {data.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={data.last}
                  onClick={() => setPage((current) => current + 1)}
                >
                  다음
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default PropertyListPage;
