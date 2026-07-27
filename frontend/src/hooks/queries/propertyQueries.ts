import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  createProperty,
  getMyProperties,
  getProperties,
  getPropertiesInBounds,
  getProperty,
  uploadPropertyImages,
} from "@/api/property";
import type {
  MapBounds,
  Page,
  PagingParams,
  PropertyDetail,
  PropertyFilters,
  PropertySummary,
} from "@/types";

export const propertyKeys = {
  all: ["properties"] as const,
  lists: () => [...propertyKeys.all, "list"] as const,
  list: (filters: PropertyFilters, paging: PagingParams) =>
    [...propertyKeys.lists(), filters, paging] as const,
  myLists: () => [...propertyKeys.all, "my-list"] as const,
  myList: (paging: PagingParams) =>
    [...propertyKeys.myLists(), paging] as const,
  maps: () => [...propertyKeys.all, "map"] as const,
  map: (bounds: MapBounds) => [...propertyKeys.maps(), bounds] as const,
  details: () => [...propertyKeys.all, "detail"] as const,
  detail: (propertyId: number) =>
    [...propertyKeys.details(), propertyId] as const,
};

export const propertyListOptions = (
  filters: PropertyFilters,
  paging: PagingParams = {},
) =>
  queryOptions({
    queryKey: propertyKeys.list(filters, paging),
    queryFn: ({ signal }) => getProperties(filters, paging, signal),
    // 페이지 이동 중 목록이 빈 화면으로 깜빡이지 않도록 이전 페이지를 유지
    placeholderData: keepPreviousData,
  });

export const myPropertyListOptions = (paging: PagingParams = {}) =>
  queryOptions({
    queryKey: propertyKeys.myList(paging),
    queryFn: ({ signal }) => getMyProperties(paging, signal),
    placeholderData: keepPreviousData,
  });

export const propertyDetailOptions = (propertyId: number) =>
  queryOptions({
    queryKey: propertyKeys.detail(propertyId),
    queryFn: ({ signal }) => getProperty(propertyId, signal),
  });

export const propertyMapOptions = (bounds: MapBounds) =>
  queryOptions({
    queryKey: propertyKeys.map(bounds),
    queryFn: ({ signal }) => getPropertiesInBounds(bounds, signal),
  });

export function usePropertyList(
  filters: PropertyFilters,
  paging: PagingParams = {},
) {
  return useQuery(propertyListOptions(filters, paging));
}

// enabled: 중개사만 조회 대상이라, 권한이 없을 때는 401이 뻔한 요청을 아예 보내지 않는다
export function useMyPropertyList(paging: PagingParams = {}, enabled = true) {
  return useQuery({ ...myPropertyListOptions(paging), enabled });
}

export function usePropertyDetail(propertyId: number) {
  return useQuery(propertyDetailOptions(propertyId));
}

export function usePropertiesInBounds(bounds: MapBounds) {
  return useQuery(propertyMapOptions(bounds));
}

// PROP-04·05 저장 토글 — 백엔드에 찜 API가 아직 없어 서버 호출 없이 캐시의 표시 상태만 뒤집는다.
// (다시 조회하면 서버 값으로 돌아간다. 엔드포인트가 생기면 useMutation으로 교체할 것)
export function useToggleSavedInCache() {
  const queryClient = useQueryClient();

  return (propertyId: number) => {
    queryClient.setQueriesData<Page<PropertySummary>>(
      { queryKey: propertyKeys.lists() },
      (page) =>
        page && {
          ...page,
          content: page.content.map((property) =>
            property.propertyId === propertyId
              ? { ...property, saved: !property.saved }
              : property,
          ),
        },
    );
    queryClient.setQueryData<PropertyDetail>(
      propertyKeys.detail(propertyId),
      (property) => property && { ...property, saved: !property.saved },
    );
  };
}

export function useCreateProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createProperty,
    onSuccess: (property) => {
      queryClient.setQueryData(
        propertyKeys.detail(property.propertyId),
        property,
      );
      queryClient.invalidateQueries({ queryKey: propertyKeys.lists() });
      queryClient.invalidateQueries({ queryKey: propertyKeys.myLists() });
      queryClient.invalidateQueries({ queryKey: propertyKeys.maps() });
    },
  });
}

// 매물 등록 직후 사진 업로드 — 매물은 이미 만들어진 뒤라 실패해도 등록 자체는 유효하다
export function useUploadPropertyImages() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      propertyId,
      files,
    }: {
      propertyId: number;
      files: File[];
    }) => uploadPropertyImages(propertyId, files),
    onSuccess: (_images, { propertyId }) => {
      queryClient.invalidateQueries({
        queryKey: propertyKeys.detail(propertyId),
      });
      queryClient.invalidateQueries({ queryKey: propertyKeys.lists() });
      queryClient.invalidateQueries({ queryKey: propertyKeys.myLists() });
    },
  });
}
