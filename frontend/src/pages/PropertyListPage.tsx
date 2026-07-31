import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { useToggleFavorite } from "@/hooks/queries/favoriteQueries";
import { usePropertyList } from "@/hooks/queries/propertyQueries";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatPrice } from "@/lib/format";
import { loadKakaoMapSdk } from "@/lib/kakaoMap";
import { parseRegionQuery } from "@/lib/regionSearch";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import type { DealType, Filters, PropertyFilters, RoomType } from "@/types";

const SKELETON_COUNT = 6;
const MAP_RESULT_SIZE = 100;
type KakaoPoint = object;
type KakaoMap = {
  panTo: (position: KakaoPoint) => void;
  relayout: () => void;
  setBounds: (bounds: { extend: (position: KakaoPoint) => void }) => void;
};
type KakaoMarker = object;
type KakaoCluster = {
  getMarkers: () => KakaoMarker[];
};
type KakaoClusterer = {
  clear: () => void;
  addMarkers: (markers: KakaoMarker[]) => void;
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
  }) => KakaoClusterer;
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

// 목록 응답에는 개별 위경도가 없어 같은 동의 매물이 동일 좌표에 겹친다.
// 같은 주소의 두 번째 매물부터 가까운 반경에 펼쳐, 확대 시 모든 핀이 보이게 한다.
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

function getKakaoMaps() {
  return (window as Window & { kakao?: { maps: KakaoSdk } }).kakao?.maps;
}

// 지도 생성은 컨테이너가 실제 크기를 가진 뒤여야 한다 — 크기 확정 전에 만들면
// 내부 뷰포트 계산이 어긋나 빈 지도가 나온다 (relayout 타이머로 때우지 않는다)
function waitForContainerSize(el: HTMLElement) {
  return new Promise<void>((resolve) => {
    if (el.clientWidth > 0 && el.clientHeight > 0) {
      resolve();
      return;
    }
    const observer = new ResizeObserver(() => {
      if (el.clientWidth > 0 && el.clientHeight > 0) {
        observer.disconnect();
        resolve();
      }
    });
    observer.observe(el);
  });
}

// 주소 → 좌표 캐시 — 필터가 바뀌어도 같은 동은 다시 지오코딩하지 않는다 (카카오 쿼터 절약)
const geocodeCache = new Map<
  string,
  Promise<{ latitude: number; longitude: number } | null>
>();

function geocodeAddress(maps: KakaoSdk, address: string) {
  const cached = geocodeCache.get(address);
  if (cached) {
    return cached;
  }

  const lookup = new Promise<{ latitude: number; longitude: number } | null>(
    (resolve) => {
      new maps.services.Geocoder().addressSearch(address, (result, status) => {
        if (status !== maps.services.Status.OK || !result[0]) {
          resolve(null);
          return;
        }
        resolve({
          latitude: Number(result[0].y),
          longitude: Number(result[0].x),
        });
      });
    },
  );
  geocodeCache.set(address, lookup);
  // 실패(쿼터·일시 오류)는 캐시에 남기지 않아 다음 갱신에서 재시도된다
  void lookup.then((position) => {
    if (position === null) {
      geocodeCache.delete(address);
    }
  });
  return lookup;
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
  onToggleSave: (id: number, saved: boolean) => void;
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const dragStartYRef = useRef<number | null>(null);
  const didDragResultsRef = useRef(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [clusterPropertyIds, setClusterPropertyIds] = useState<number[] | null>(
    null,
  );
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [map, setMap] = useState<KakaoMap | null>(null);
  const clustererRef = useRef<KakaoClusterer | null>(null);
  // clusterclick 리스너는 지도 생성 시 한 번만 달리므로,
  // 마커 배치가 바뀔 때마다 ref로 최신 마커 → 매물 매핑을 넘겨준다
  const propertyByMarkerRef = useRef(new Map<KakaoMarker, PropertyCardItem>());
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

  // 지도 생성은 마운트에 1회 — SDK 로드 후 컨테이너 크기가 확정되면 만든다
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || !appKey) {
      return;
    }

    let cancelled = false;
    let relayoutFrame = 0;
    let resizeObserver: ResizeObserver | null = null;

    loadKakaoMapSdk()
      .then(() => waitForContainerSize(container))
      .then(() => {
        const maps = getKakaoMaps();
        if (cancelled || !maps) {
          return;
        }

        const createdMap = new maps.Map(container, {
          center: new maps.LatLng(37.5665, 126.978),
          level: 8,
          draggable: true,
        });

        const clusterer = new maps.MarkerClusterer({
          map: createdMap,
          markers: [],
          averageCenter: true,
          minLevel: 6,
          disableClickZoom: true,
          clickable: true,
          calculator: [10, 30, 50],
          styles: [CLUSTER_STYLE, CLUSTER_STYLE, CLUSTER_STYLE, CLUSTER_STYLE],
        });

        maps.event.addListener(clusterer, "clusterclick", (cluster) => {
          if (!cluster) {
            return;
          }
          const ids = cluster
            .getMarkers()
            .map((marker) => propertyByMarkerRef.current.get(marker)?.id)
            .filter((id): id is number => id !== undefined);

          setSelectedId(null);
          setClusterPropertyIds(ids);
          setIsResultsOpen(true);
        });

        // 생성 이후의 창 크기 변경에는 relayout만 필요하다
        resizeObserver = new ResizeObserver(() => {
          cancelAnimationFrame(relayoutFrame);
          relayoutFrame = requestAnimationFrame(() => createdMap.relayout());
        });
        resizeObserver.observe(container);

        clustererRef.current = clusterer;
        setMap(createdMap);
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
      cancelAnimationFrame(relayoutFrame);
      resizeObserver?.disconnect();
      clustererRef.current = null;
      setMap(null);
      container.replaceChildren();
    };
  }, [appKey]);

  // 매물 목록이 바뀌면 지도는 그대로 두고 핀만 갈아끼운다
  useEffect(() => {
    const clusterer = clustererRef.current;
    const maps = getKakaoMaps();
    if (!map || !clusterer || !maps) {
      return;
    }

    let cancelled = false;
    const addressOccurrences = new Map<string, number>();

    const markerPromises = properties.map(async (property) => {
      const address = `${property.region} ${property.dong}`;
      const overlapIndex = addressOccurrences.get(address) ?? 0;
      addressOccurrences.set(address, overlapIndex + 1);

      const geocoded = await geocodeAddress(maps, address);
      if (cancelled || !geocoded) {
        return null;
      }

      const spreadPosition = spreadOverlappingPosition(
        geocoded.latitude,
        geocoded.longitude,
        overlapIndex,
      );
      const position = new maps.LatLng(
        spreadPosition.latitude,
        spreadPosition.longitude,
      );
      const marker = new maps.Marker({ position, title: property.title });

      maps.event.addListener(marker, "click", () => {
        setSelectedId(property.id);
        setClusterPropertyIds(null);
        setIsResultsOpen(true);
        map.panTo(position);
      });
      return { marker, property, position };
    });

    void Promise.all(markerPromises).then((results) => {
      if (cancelled) {
        return;
      }

      const placed = results.filter(
        (result): result is NonNullable<typeof result> => result !== null,
      );
      const propertyByMarker = new Map<KakaoMarker, PropertyCardItem>();
      const bounds = new maps.LatLngBounds();
      for (const { marker, property, position } of placed) {
        propertyByMarker.set(marker, property);
        bounds.extend(position);
      }
      propertyByMarkerRef.current = propertyByMarker;

      clusterer.clear();
      if (placed.length === 0) {
        return;
      }
      clusterer.addMarkers(placed.map(({ marker }) => marker));
      map.setBounds(bounds);
    });

    return () => {
      cancelled = true;
    };
  }, [map, properties]);

  return (
    <div className="relative h-[calc(100svh-12rem)] min-h-[32rem] overflow-hidden rounded-xl border bg-muted">
      {/* touch-none — 지도 제스처를 페이지 스크롤에 뺏기지 않는다 */}
      <div ref={mapContainerRef} className="absolute inset-0 touch-none" />

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
                  onClick={() => onToggleSave(property.id, !property.saved)}
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
// "서울시 강남구 역삼동" 같은 검색어는 시군구 필터와 나머지 검색어로 분리하되,
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
  const [saveError, setSaveError] = useState<string | null>(null);
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const debouncedQuery = useDebouncedValue(filters.query.trim());
  const { mutate: toggleFavorite } = useToggleFavorite();

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

  // 저장은 로그인 사용자만 가능 — 비로그인 상태에서는 401 대신 로그인 화면으로 보낸다
  const handleToggleSave = (propertyId: number, saved: boolean) => {
    if (!user) {
      navigate("/login");
      return;
    }
    setSaveError(null);
    toggleFavorite(
      { propertyId, saved },
      {
        onError: () =>
          setSaveError(
            saved
              ? "매물을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요."
              : "저장을 취소하지 못했습니다. 잠시 후 다시 시도해 주세요.",
          ),
      },
    );
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
                onToggleSave={handleToggleSave}
              />
            </div>
          </>
        )}
      </main>

      {saveError && (
        <div
          role="alert"
          className="fixed inset-x-0 bottom-4 z-30 mx-auto w-fit max-w-[calc(100%-2rem)] rounded-xl border bg-background px-4 py-3 text-sm shadow-sm"
        >
          {saveError}
        </div>
      )}
    </div>
  );
}

export default PropertyListPage;
