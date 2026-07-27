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
} from "@/api/property";
import type { MapBounds, PagingParams, PropertyFilters } from "@/types";

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

export function useMyPropertyList(paging: PagingParams = {}) {
  return useQuery(myPropertyListOptions(paging));
}

export function usePropertyDetail(propertyId: number) {
  return useQuery(propertyDetailOptions(propertyId));
}

export function usePropertiesInBounds(bounds: MapBounds) {
  return useQuery(propertyMapOptions(bounds));
}

export function useCreateProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createProperty,
    onSuccess: (property) => {
      console.log(property);
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
