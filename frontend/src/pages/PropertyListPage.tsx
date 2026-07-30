import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Heart,
  ImageIcon,
  Plus,
  SearchX,
} from "lucide-react";

import {
  toPropertyCardItem,
  type PropertyCardItem,
} from "@/components/PropertyCard";
import PropertyFilterBar, {
  DEFAULT_FILTERS,
} from "@/components/PropertyFilterBar";
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
import { formatPrice } from "@/lib/format";
import { parseRegionQuery } from "@/lib/regionSearch";
import { cn } from "@/lib/utils";
import type { DealType, Filters, PropertyFilters, RoomType } from "@/types";

const SKELETON_COUNT = 6;
const MAP_RESULT_SIZE = 100;
type KakaoPoint = object;
type KakaoMap = {
  panTo: (position: KakaoPoint) => void;
  panBy: (dx: number, dy: number) => void;
  setBounds: (bounds: { extend: (position: KakaoPoint) => void }) => void;
  setDraggable: (draggable: boolean) => void;
  setZoomable: (zoomable: boolean) => void;
};
type KakaoMarker = object;
type KakaoCluster = {
  getMarkers: () => KakaoMarker[];
};
type KakaoClusterStyle = {
  width: string;
  height: string;
  background: string;
  borderRadius: string;
  color: string;
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  textAlign: string;
  boxShadow: string;
};
type KakaoSdk = {
  load: (callback: () => void) => void;
  Map: new (
    container: HTMLElement,
    options: { center: KakaoPoint; level: number; draggable?: boolean },
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
    calculator: number[];
    styles: KakaoClusterStyle[];
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

const CLUSTER_STYLE: KakaoClusterStyle = {
  width: "48px",
  height: "48px",
  background: "#1677ff",
  borderRadius: "50%",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: "700",
  lineHeight: "48px",
  textAlign: "center",
  boxShadow: "0 3px 12px rgba(22, 119, 255, 0.38)",
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

function PropertyMap({
  properties,
  onOpen,
  onToggleSave,
}: {
  properties: PropertyCardItem[];
  onOpen: (id: number) => void;
  onToggleSave: (id: number) => void;
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<KakaoMap | null>(null);
  const mouseDragRef = useRef<{
    x: number;
    y: number;
    dragging: boolean;
  } | null>(null);
  const dragStartYRef = useRef<number | null>(null);
  const didDragResultsRef = useRef(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [clusterPropertyIds, setClusterPropertyIds] = useState<number[] | null>(
    null,
  );
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const appKey = import.meta.env.VITE_KAKAO_KEY;
  const selectedProperty = properties.find(
    (property) => property.id === selectedId,
  );
  const visibleProperties = selectedProperty
    ? [selectedProperty]
    : clusterPropertyIds
      ? properties.filter((property) =>
          clusterPropertyIds.includes(property.id),
        )
      : properties;

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
          draggable: true,
        });
        mapInstanceRef.current = map;
        map.setDraggable(true);
        map.setZoomable(true);
        const geocoder = new maps.services.Geocoder();
        const bounds = new maps.LatLngBounds();
        const propertyByMarker = new Map<KakaoMarker, PropertyCardItem>();

        const markerPromises = properties.map(
          (property) =>
            new Promise<KakaoMarker | null>((resolve) => {
              geocoder.addressSearch(
                `${property.region} ${property.dong}`,
                (result, status) => {
                  if (
                    cancelled ||
                    status !== maps.services.Status.OK ||
                    !result[0]
                  ) {
                    resolve(null);
                    return;
                  }

                  const position = new maps.LatLng(
                    Number(result[0].y),
                    Number(result[0].x),
                  );
                  const marker = new maps.Marker({
                    position,
                    title: property.title,
                  });

                  propertyByMarker.set(marker, property);
                  bounds.extend(position);
                  maps.event.addListener(marker, "click", () => {
                    setSelectedId(property.id);
                    setClusterPropertyIds(null);
                    setIsResultsOpen(true);
                    map.panTo(position);
                  });
                  resolve(marker);
                },
              );
            }),
        );

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
            calculator: [10, 30, 50],
            styles: [
              CLUSTER_STYLE,
              CLUSTER_STYLE,
              CLUSTER_STYLE,
              CLUSTER_STYLE,
            ],
          });

          maps.event.addListener(clusterer, "clusterclick", (cluster) => {
            if (!cluster) {
              return;
            }
            const ids = cluster
              .getMarkers()
              .map((marker) => propertyByMarker.get(marker)?.id)
              .filter((id): id is number => id !== undefined);

            setSelectedId(null);
            setClusterPropertyIds(ids);
            setIsResultsOpen(true);
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
      mapInstanceRef.current = null;
      container.replaceChildren();
    };
  }, [appKey, properties]);

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) {
      return;
    }

    const handleMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) {
        return;
      }
      const map = mapInstanceRef.current;
      if (!map) {
        return;
      }

      // 카카오 내부 드래그 핸들러가 같은 mousedown을 처리하기 전에
      // 데스크톱 지도 이동 상태를 반드시 다시 활성화한다.
      map.setDraggable(true);
      map.setZoomable(true);
      mouseDragRef.current = {
        x: event.clientX,
        y: event.clientY,
        dragging: false,
      };
    };

    const handleMouseMove = (event: MouseEvent) => {
      const drag = mouseDragRef.current;
      const map = mapInstanceRef.current;
      if (!drag || !map) {
        return;
      }

      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!drag.dragging && Math.hypot(dx, dy) < 4) {
        return;
      }

      drag.dragging = true;
      event.preventDefault();
      map.panBy(-dx, -dy);
      drag.x = event.clientX;
      drag.y = event.clientY;
    };

    const finishMouseDrag = () => {
      mouseDragRef.current = null;
    };

    container.addEventListener("mousedown", handleMouseDown, true);
    window.addEventListener("mousemove", handleMouseMove, true);
    window.addEventListener("mouseup", finishMouseDrag, true);
    window.addEventListener("blur", finishMouseDrag);

    return () => {
      container.removeEventListener("mousedown", handleMouseDown, true);
      window.removeEventListener("mousemove", handleMouseMove, true);
      window.removeEventListener("mouseup", finishMouseDrag, true);
      window.removeEventListener("blur", finishMouseDrag);
    };
  }, []);

  return (
    <div className="relative h-[calc(100svh-12rem)] min-h-[32rem] overflow-hidden rounded-xl border bg-muted">
      <div
        ref={mapContainerRef}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
      />

      <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-lg bg-background/95 px-3 py-2 text-sm shadow-sm">
        지도에 표시된 매물 <strong>{properties.length}건</strong>
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

      <section
        className={cn(
          "absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-2xl border-t bg-background shadow-[0_-4px_16px_rgba(15,23,42,0.12)] transition-[height] duration-300",
          isResultsOpen ? "h-[72%]" : "h-16",
        )}
        aria-label="지도 검색 결과"
      >
        <button
          type="button"
          className="relative flex h-16 shrink-0 touch-none items-center justify-between px-5 pt-2 text-left"
          aria-expanded={isResultsOpen}
          onClick={() => {
            if (didDragResultsRef.current) {
              didDragResultsRef.current = false;
              return;
            }
            setIsResultsOpen((current) => !current);
          }}
          onPointerDown={(event) => {
            didDragResultsRef.current = false;
            dragStartYRef.current = event.clientY;
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerUp={(event) => {
            const startY = dragStartYRef.current;
            dragStartYRef.current = null;
            if (startY === null) {
              return;
            }

            const distance = event.clientY - startY;
            if (distance < -30) {
              didDragResultsRef.current = true;
              setIsResultsOpen(true);
            }
            if (distance > 30) {
              didDragResultsRef.current = true;
              setIsResultsOpen(false);
            }
          }}
        >
          <span
            aria-hidden
            className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-border"
          />
          <span>
            <span className="block font-semibold">
              {selectedProperty
                ? "매물 상세"
                : `매물 ${visibleProperties.length}건`}
            </span>
            {!isResultsOpen && (
              <span className="text-xs text-muted-foreground">
                위로 올려 목록 보기
              </span>
            )}
          </span>
          {isResultsOpen ? (
            <ChevronDown className="size-5 text-muted-foreground" />
          ) : (
            <ChevronUp className="size-5 text-muted-foreground" />
          )}
        </button>

        <div className="min-h-0 flex-1 overflow-y-auto border-t px-4 py-2">
          {visibleProperties.map((property) => {
            const isSelected = property.id === selectedId;

            return (
              <div
                key={property.id}
                className={cn(
                  "flex items-center gap-3 rounded-xl p-2 transition-colors",
                  isSelected
                    ? "bg-primary/5 ring-1 ring-primary/20"
                    : "hover:bg-muted",
                )}
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  onClick={() => onOpen(property.id)}
                >
                  {property.imageUrl ? (
                    <img
                      src={property.imageUrl}
                      alt=""
                      className="size-20 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <span className="grid size-20 shrink-0 place-items-center rounded-lg bg-muted">
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
                <button
                  type="button"
                  className="grid size-9 shrink-0 place-items-center rounded-full hover:bg-background"
                  aria-label={property.saved ? "매물 저장 취소" : "매물 저장"}
                  aria-pressed={property.saved}
                  onClick={() => onToggleSave(property.id)}
                >
                  <Heart
                    className={cn(
                      "size-5",
                      property.saved
                        ? "fill-primary text-primary"
                        : "text-muted-foreground",
                    )}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </section>
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

// PAGE-03·04 통합 매물 탐색 — 지도와 목록은 같은 검색 결과를 함께 보여준다.
function PropertyListPage({
  canCreate,
  onOpen,
  onCreate,
}: PropertyListPageProps) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const debouncedQuery = useDebouncedValue(filters.query.trim());
  const toggleSaved = useToggleSavedInCache();

  const queryFilters = useMemo(
    () => toQueryFilters(filters, debouncedQuery),
    [filters, debouncedQuery],
  );
  const { data, isPending, isError, refetch } = usePropertyList(queryFilters, {
    page: 0,
    size: MAP_RESULT_SIZE,
  });
  const items = useMemo(
    () => data?.content.map(toPropertyCardItem) ?? [],
    [data],
  );

  const changeFilters = (next: Filters) => {
    setFilters(next);
  };

  // 거래유형이 바뀌면 가격 축 의미가 달라지므로 가격 구간을 초기화
  const handleDealTypeChange = (dealType: string) =>
    changeFilters({ ...filters, dealType, price: "all", rent: "all" });

  return (
    <div className="min-h-svh bg-background">
      <header>
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-6">
          <div className="flex w-full items-center justify-between">
            <h1 className="text-lg font-semibold">매물 찾기</h1>
            {canCreate && (
              <Button size="sm" onClick={onCreate}>
                <Plus />
                매물 등록
              </Button>
            )}
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
            <Skeleton className="h-[26rem] w-full rounded-xl sm:h-[34rem]" />
            <Skeleton className="mt-8 h-5 w-24" />
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: SKELETON_COUNT }, (_, i) => (
                <PropertyCardSkeleton key={i} />
              ))}
            </div>
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
            <div className="mt-4">
              <PropertyMap
                properties={items}
                onOpen={onOpen}
                onToggleSave={toggleSaved}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default PropertyListPage;
