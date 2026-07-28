import { ApiError } from "@/api/error";
import { PROPERTIES } from "@/data/properties";
import { readFileAsDataUrl } from "@/lib/file";
import { useAuthStore } from "@/stores/authStore";
import type {
  MapBounds,
  Page,
  PagingParams,
  Property,
  PropertyCreateInput,
  PropertyDetail,
  PropertyFilters,
  PropertyMapPin,
  PropertySummary,
} from "@/types";

// 매물 API를 잠시 끄고 목데이터(src/data/properties.ts)를 그대로 보여주기 위한 임시 어댑터.
// src/api/property.ts와 시그니처가 같으므로, 서버에 다시 붙일 때는
// hooks/queries/propertyQueries.ts의 import 경로만 "@/api/property"로 되돌리면 된다.

const MOCK_LATENCY_MS = 300;
const DEFAULT_PAGE_SIZE = 20;
const MOCK_CREATED_AT = "2026-07-01T09:00:00.000Z";
// 목데이터에는 거래 상태가 없어 목록·상세에서 같은 값으로 표시한다
const MOCK_STATUS = "거래가능";

// 목데이터 + 등록 폼으로만 들어오는 상세 전용 값 (목데이터에는 없는 필드들)
interface MockProperty extends Property {
  complexName?: string;
  maintenanceFee?: number;
  roadAddress?: string;
  builtYear?: number;
  description?: string;
  latitude?: number;
  longitude?: number;
  createdAt: string;
}

// 등록·저장 토글 결과가 화면을 옮겨도 유지되도록 목데이터 사본을 모듈에서 들고 있는다
const store: MockProperty[] = PROPERTIES.map((property) => ({
  ...property,
  createdAt: MOCK_CREATED_AT,
}));

// 목 응답도 로딩 상태를 거치도록 약간의 지연을 두고, 취소된 요청은 그대로 중단한다
function respond<T>(value: T, signal?: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(value), MOCK_LATENCY_MS);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("요청이 취소되었습니다.", "AbortError"));
    });
  });
}

function notFound(propertyId: number) {
  return new ApiError(
    404,
    "PROPERTY_NOT_FOUND",
    `매물(${propertyId})을 찾을 수 없습니다.`,
  );
}

function toSummary(property: MockProperty): PropertySummary {
  return {
    propertyId: property.id,
    title: property.title,
    transactionType: property.dealType,
    // 목데이터의 "아파트"는 백엔드 roomType enum에 없지만 표시용으로 그대로 내보낸다
    roomType: property.buildingType as PropertySummary["roomType"],
    deposit: property.deposit,
    monthlyRent: property.monthlyRent,
    sigungu: property.region,
    dong: property.dong,
    complexName: property.complexName,
    area: property.areaM2,
    floor: property.floor,
    totalFloor: property.totalFloors,
    status: MOCK_STATUS,
    saved: property.saved,
    imageUrl: property.imageUrl,
  };
}

function toDetail(property: MockProperty): PropertyDetail {
  return {
    ...toSummary(property),
    maintenanceFee: property.maintenanceFee,
    roadAddress: property.roadAddress,
    builtYear: property.builtYear,
    latitude: property.latitude,
    longitude: property.longitude,
    description: property.description,
    createdAt: property.createdAt,
    rooms: property.rooms,
    imageUrls: property.imageUrls,
    nearbyFacilities: property.nearbyFacilities,
  };
}

function matchesFilters(property: MockProperty, filters: PropertyFilters) {
  const { query, sigungu, transactionType, roomType, minDeposit, maxDeposit } =
    filters;

  if (
    query &&
    ![property.title, property.region, property.dong].some((value) =>
      value.includes(query),
    )
  ) {
    return false;
  }
  if (sigungu && property.region !== sigungu) {
    return false;
  }
  if (transactionType && property.dealType !== transactionType) {
    return false;
  }
  if (roomType && property.buildingType !== roomType) {
    return false;
  }
  if (minDeposit !== undefined && property.deposit < minDeposit) {
    return false;
  }
  // 가격 구간의 상한은 다음 구간의 하한과 같아, 상한 자체는 포함하지 않는다
  if (maxDeposit !== undefined && property.deposit >= maxDeposit) {
    return false;
  }
  return true;
}

function toPage<T>(
  items: T[],
  { page = 0, size = DEFAULT_PAGE_SIZE }: PagingParams,
): Page<T> {
  const totalPages = Math.max(1, Math.ceil(items.length / size));
  const content = items.slice(page * size, page * size + size);

  return {
    content,
    number: page,
    size,
    totalElements: items.length,
    totalPages,
    first: page === 0,
    last: page >= totalPages - 1,
    empty: content.length === 0,
  };
}

export function getProperties(
  filters: PropertyFilters,
  paging: PagingParams = {},
  signal?: AbortSignal,
): Promise<Page<PropertySummary>> {
  const matched = store.filter((property) => matchesFilters(property, filters));
  return respond(toPage(matched.map(toSummary), paging), signal);
}

// 로그인한 중개사가 등록한 매물만 조회 — 목데이터의 brokerId와 로그인 계정 id를 맞춘다
export function getMyProperties(
  paging: PagingParams = {},
  signal?: AbortSignal,
): Promise<Page<PropertySummary>> {
  const userId = useAuthStore.getState().user?.id;
  const mine = store.filter((property) => property.brokerId === userId);
  return respond(toPage(mine.map(toSummary), paging), signal);
}

export function getProperty(
  propertyId: number,
  signal?: AbortSignal,
): Promise<PropertyDetail> {
  const property = store.find((item) => item.id === propertyId);
  if (!property) {
    return Promise.reject(notFound(propertyId));
  }
  return respond(toDetail(property), signal);
}

// 지도 영역 안의 매물 핀 — 목데이터에는 좌표가 없어 등록하면서 좌표가 잡힌 매물만 나온다
export function getPropertiesInBounds(
  bounds: MapBounds,
  signal?: AbortSignal,
): Promise<PropertyMapPin[]> {
  const pins = store
    .filter(
      (
        property,
      ): property is MockProperty & { latitude: number; longitude: number } =>
        property.latitude !== undefined &&
        property.longitude !== undefined &&
        property.latitude >= bounds.swLat &&
        property.latitude <= bounds.neLat &&
        property.longitude >= bounds.swLng &&
        property.longitude <= bounds.neLng,
    )
    .map((property) => ({
      propertyId: property.id,
      title: property.title,
      latitude: property.latitude,
      longitude: property.longitude,
      transactionType: property.dealType,
      deposit: property.deposit,
      monthlyRent: property.monthlyRent,
    }));

  return respond(pins, signal);
}

export function createProperty(
  input: PropertyCreateInput,
): Promise<PropertyDetail> {
  const created: MockProperty = {
    id: Math.max(0, ...store.map((property) => property.id)) + 1,
    brokerId: useAuthStore.getState().user?.id ?? 0,
    title: input.title,
    dealType: input.transactionType,
    buildingType: input.roomType,
    deposit: input.deposit,
    monthlyRent: input.monthlyRent ?? 0,
    region: input.sigungu,
    dong: input.dong,
    areaM2: input.area ?? 0,
    floor: input.floor ?? 0,
    totalFloors: input.totalFloor,
    rooms: input.rooms ?? 0,
    saved: false,
    complexName: input.complexName,
    maintenanceFee: input.maintenanceFee,
    roadAddress: input.roadAddress,
    builtYear: input.builtYear,
    description: input.description,
    latitude: input.latitude,
    longitude: input.longitude,
    createdAt: new Date().toISOString(),
  };

  store.unshift(created);
  return respond(toDetail(created));
}

// 등록 직후 사진 업로드 — 서버가 없으니 data URL로 바꿔 목데이터에 그대로 붙인다
export async function uploadPropertyImages(
  propertyId: number,
  files: File[],
): Promise<string[]> {
  const property = store.find((item) => item.id === propertyId);
  if (!property) {
    throw notFound(propertyId);
  }

  const imageUrls = await Promise.all(files.map(readFileAsDataUrl));
  property.imageUrl = imageUrls[0];
  property.imageUrls = imageUrls;

  return respond(imageUrls);
}

// PROP-04·05 저장 토글 — 다시 조회해도 유지되도록 목데이터 쪽 값을 함께 뒤집는다
export function toggleMockSaved(propertyId: number) {
  const property = store.find((item) => item.id === propertyId);
  if (property) {
    property.saved = !property.saved;
  }
}

// PROP-07·08 등록·수정 결과를 목데이터에 반영 (없으면 추가, 있으면 교체)
export function upsertMockProperty(property: Property) {
  const index = store.findIndex((item) => item.id === property.id);
  if (index === -1) {
    store.unshift({ ...property, createdAt: new Date().toISOString() });
    return;
  }
  store[index] = { ...store[index], ...property };
}

// PROP-09 삭제
export function removeMockProperty(propertyId: number) {
  const index = store.findIndex((item) => item.id === propertyId);
  if (index !== -1) {
    store.splice(index, 1);
  }
}
