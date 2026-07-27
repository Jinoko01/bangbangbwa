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

// PROP-07 매물 사진 업로드 — 등록으로 매물 id가 나온 뒤 파일만 multipart로 따로 보낸다.
// 첫 번째 파일이 목록·상세의 대표 사진이 된다. 응답은 저장된 사진 URL 목록.
export function uploadPropertyImages(
  propertyId: number,
  files: File[],
): Promise<string[]> {
  const formData = new FormData();
  files.forEach((file) => formData.append("images", file));

  return api.post<string[]>({
    path: `${PROPERTIES_PATH}/${propertyId}/images`,
    body: formData,
  });
}
