import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  addFavorite,
  getFavoriteProperties,
  removeFavorite,
} from "@/api/favorite";
import type { Page, PagingParams, PropertySummary } from "@/types";

export const favoriteKeys = {
  all: ["favorites"] as const,
  lists: () => [...favoriteKeys.all, "list"] as const,
  list: (paging: PagingParams) => [...favoriteKeys.lists(), paging] as const,
};

export const favoritePropertyListOptions = (paging: PagingParams = {}) =>
  queryOptions({
    queryKey: favoriteKeys.list(paging),
    queryFn: ({ signal }) => getFavoriteProperties(paging, signal),
    // 페이지 이동 중 목록이 빈 화면으로 깜빡이지 않도록 이전 페이지를 유지
    placeholderData: keepPreviousData,
  });

export function useFavoritePropertyList(paging: PagingParams = {}) {
  return useQuery(favoritePropertyListOptions(paging));
}

// PROP-04·05 저장 토글 — 하트는 즉시 반응해야 하므로 캐시를 선반영하고 실패하면 되돌린다.
// 해제한 매물은 목록에서 곧바로 빼지 않고(다시 눌러 되돌릴 수 있게) 다음 진입 때 새로 받는다.
export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      propertyId,
      saved,
    }: {
      propertyId: number;
      saved: boolean;
    }) => (saved ? addFavorite(propertyId) : removeFavorite(propertyId)),
    onMutate: async ({ propertyId, saved }) => {
      await queryClient.cancelQueries({ queryKey: favoriteKeys.lists() });
      const previous = queryClient.getQueriesData<Page<PropertySummary>>({
        queryKey: favoriteKeys.lists(),
      });
      queryClient.setQueriesData<Page<PropertySummary>>(
        { queryKey: favoriteKeys.lists() },
        (page) =>
          page && {
            ...page,
            content: page.content.map((property) =>
              property.propertyId === propertyId
                ? { ...property, saved }
                : property,
            ),
          },
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      context?.previous.forEach(([queryKey, page]) =>
        queryClient.setQueryData(queryKey, page),
      );
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: favoriteKeys.lists(),
        refetchType: "none",
      }),
  });
}
