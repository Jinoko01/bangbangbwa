import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  deletePropertyDocument,
  downloadPropertyDocument,
  getPropertyDocuments,
  registerPropertyDocument,
  replacePropertyDocument,
} from "@/api/propertyDocument";
import { saveBlobAsFile } from "@/lib/file";
import type { DocumentType } from "@/types";

export const propertyDocumentKeys = {
  all: ["property-documents"] as const,
  lists: () => [...propertyDocumentKeys.all, "list"] as const,
  list: (propertyId: number) =>
    [...propertyDocumentKeys.lists(), propertyId] as const,
};

// AI 분석이 끝나기까지 걸리는 시간을 서버가 알려주지 않아 짧은 간격으로 되묻는다
const ANALYSIS_POLL_INTERVAL_MS = 5_000;

export const propertyDocumentListOptions = (propertyId: number) =>
  queryOptions({
    queryKey: propertyDocumentKeys.list(propertyId),
    queryFn: ({ signal }) => getPropertyDocuments(propertyId, signal),
    // 분석 중인 서류가 남아 있는 동안만 폴링하고, 모두 끝나면 스스로 멈춘다
    refetchInterval: (query) =>
      query.state.data?.some((document) => document.status === "PROCESSING")
        ? ANALYSIS_POLL_INTERVAL_MS
        : false,
  });

// enabled: 서류 조회는 인증이 필요하다 — 비로그인 상세 화면에서 401을 만들지 않기 위해 끈다
export function usePropertyDocuments(propertyId: number, enabled = true) {
  return useQuery({ ...propertyDocumentListOptions(propertyId), enabled });
}

function useDocumentListInvalidation() {
  const queryClient = useQueryClient();

  return (propertyId: number) =>
    queryClient.invalidateQueries({
      queryKey: propertyDocumentKeys.list(propertyId),
    });
}

export function useRegisterPropertyDocument() {
  const invalidateList = useDocumentListInvalidation();

  return useMutation({
    mutationFn: ({
      propertyId,
      documentType,
      file,
    }: {
      propertyId: number;
      documentType: DocumentType;
      file: File;
    }) => registerPropertyDocument(propertyId, documentType, file),
    onSuccess: (_document, { propertyId }) => invalidateList(propertyId),
  });
}

export function useReplacePropertyDocument() {
  const invalidateList = useDocumentListInvalidation();

  return useMutation({
    mutationFn: ({
      propertyId,
      documentId,
      file,
    }: {
      propertyId: number;
      documentId: number;
      file: File;
    }) => replacePropertyDocument(propertyId, documentId, file),
    onSuccess: (_document, { propertyId }) => invalidateList(propertyId),
  });
}

export function useDeletePropertyDocument() {
  const invalidateList = useDocumentListInvalidation();

  return useMutation({
    mutationFn: ({
      propertyId,
      documentId,
    }: {
      propertyId: number;
      documentId: number;
    }) => deletePropertyDocument(propertyId, documentId),
    onSuccess: (_result, { propertyId }) => invalidateList(propertyId),
  });
}

// 파일 저장까지가 한 동작이라 mutation으로 둔다 — isPending으로 중복 클릭을 막는다
export function useDownloadPropertyDocument() {
  return useMutation({
    mutationFn: async ({
      propertyId,
      fallbackFileName,
    }: {
      propertyId: number;
      fallbackFileName: string;
    }) => {
      const { blob, fileName } = await downloadPropertyDocument(propertyId);
      saveBlobAsFile(blob, fileName ?? fallbackFileName);
    },
  });
}
