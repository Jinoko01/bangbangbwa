import { api } from "@/api/client";
import type {
  MapBounds,
  Page,
  PagingParams,
  PropertyCreateInput,
  PropertyDetail,
  PropertyFilters,
  PropertyMapPin,
  PropertySummary,
} from "@/types";

// PROP-02 목록 / PROP-03 상세 / PROP-06 지도 / PROP-07 등록 (/api/properties)
// 백엔드 응답 필드명이 도메인 타입과 1:1이라 별도 변환 없이 그대로 반환한다.

const PROPERTIES_PATH = "/api/properties";

export function getProperties(
  filters: PropertyFilters,
  paging: PagingParams = {},
  signal?: AbortSignal,
): Promise<Page<PropertySummary>> {
  return api.get<Page<PropertySummary>>({
    path: PROPERTIES_PATH,
    config: { params: { ...filters, ...paging }, signal },
  });
}

// 로그인한 중개사가 등록한 매물만 조회
export function getMyProperties(
  paging: PagingParams = {},
  signal?: AbortSignal,
): Promise<Page<PropertySummary>> {
  return api.get<Page<PropertySummary>>({
    path: `${PROPERTIES_PATH}/me`,
    config: { params: paging, signal },
  });
}

export function getProperty(
  propertyId: number,
  signal?: AbortSignal,
): Promise<PropertyDetail> {
  return api.get<PropertyDetail>({
    path: `${PROPERTIES_PATH}/${propertyId}`,
    config: { signal },
  });
}

// 지도 영역(남서·북동 좌표) 안의 매물 핀
export function getPropertiesInBounds(
  bounds: MapBounds,
  signal?: AbortSignal,
): Promise<PropertyMapPin[]> {
  return api.get<PropertyMapPin[]>({
    path: `${PROPERTIES_PATH}/map`,
    config: { params: bounds, signal },
  });
}

export function createProperty(
  input: PropertyCreateInput,
): Promise<PropertyDetail> {
  return api.post<PropertyDetail>({ path: PROPERTIES_PATH, body: input });
}
