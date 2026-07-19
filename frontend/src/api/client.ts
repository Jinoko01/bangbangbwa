import axios, { type AxiosRequestConfig, type AxiosResponse } from "axios";

import { ApiError, isApiError } from "@/api/error";

// 백엔드 공통 응답 envelope — 통신 계층(client.ts) 밖으로 노출하지 않는다.
interface ApiResponse<T> {
  code: string;
  message: string;
  responseAt: string;
  success: boolean;
  data?: T;
}

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 10_000,
});

// TBD: accessToken·refreshToken 보관 위치 확정 후 주석 해제 (docs/api-module-plan.md §4-3)

// TBD: refresh 엔드포인트·토큰 보관 위치 확정 후 구현 (docs/api-module-plan.md §4-5)
// 동시에 여러 요청이 401을 받아도 refresh는 한 번만 나가야 한다 (single-flight).

client.interceptors.response.use(
  (response) => {
    const body = response.data as ApiResponse<unknown> | undefined;
    if (body?.success === false) {
      return Promise.reject(
        new ApiError(response.status, body.code, body.message),
      );
    }
    return response;
  },
  (error) => {
    if (isApiError(error)) {
      return Promise.reject(error);
    }
    if (!axios.isAxiosError(error) || !error.response) {
      return Promise.reject(
        new ApiError(0, "NETWORK_ERROR", "네트워크 연결을 확인해 주세요."),
      );
    }

    // TBD: 토큰 보관 위치 확정 후 401 → refreshOnce() → 원 요청 1회 재시도

    const body = error.response.data as ApiResponse<never> | undefined;
    return Promise.reject(
      new ApiError(
        error.response.status,
        body?.code ?? String(error.response.status),
        body?.message ?? "요청에 실패했습니다.",
      ),
    );
  },
);

type FetcherConfig = Pick<AxiosRequestConfig, "params" | "signal">;
type FetcherHeaders = AxiosRequestConfig["headers"];

// success:false는 응답 인터셉터에서 이미 reject되므로 여기서는 data만 벗긴다.
function unwrap<T>(response: AxiosResponse<ApiResponse<T>>): T {
  return response.data.data as T;
}

/**
 * 백엔드 API fetcher. 공통 envelope(`{ code, message, responseAt, data, success }`)를
 * 벗겨서 `data`만 반환하고, 실패(`success: false`·HTTP 에러·네트워크 오류)는 모두
 * {@link ApiError}로 던진다.
 *
 * 도메인 API 파일(`src/api/<도메인>.ts`)에서만 사용한다 — 컴포넌트·훅에서 직접 호출 금지.
 * 사용 규칙: docs/api-guide.md
 */
export const api = {
  /**
   * GET 요청.
   * @param options.path baseURL 기준 상대 경로 (예: `"/properties"`)
   * @param options.headers 엔드포인트 전용 추가 헤더 (공통 헤더는 인터셉터 책임)
   * @param options.config.params 쿼리스트링으로 직렬화할 객체
   * @param options.config.signal 요청 취소용 AbortSignal — 조회 함수는 TanStack Query `queryFn`의 signal을 그대로 전달할 것
   * @returns envelope의 `data` (타입 파라미터 `T`)
   * @throws {ApiError} `success: false` 응답, HTTP 에러, 네트워크 오류·타임아웃 시
   * @example
   * const properties = await api.get<Property[]>({
   *   path: "/properties",
   *   config: { params: filters, signal },
   * });
   */
  get: <T>({
    path,
    headers,
    config,
  }: {
    path: string;
    headers?: FetcherHeaders;
    config?: FetcherConfig;
  }) => client.get<ApiResponse<T>>(path, { ...config, headers }).then(unwrap),
  /**
   * POST 요청. `body`는 JSON으로 직렬화되며 `FormData`면 multipart로 전송된다.
   * @returns envelope의 `data` — 응답에 data가 없으면 `T = void`로 호출
   * @throws {ApiError}
   * @example
   * const tokens = await api.post<TokenResponse>({
   *   path: "/auth/kakao",
   *   body: { code: authCode },
   * });
   */
  post: <T>({
    path,
    body,
    headers,
    config,
  }: {
    path: string;
    body?: unknown;
    headers?: FetcherHeaders;
    config?: FetcherConfig;
  }) =>
    client
      .post<ApiResponse<T>>(path, body, { ...config, headers })
      .then(unwrap),
  /**
   * PUT 요청 — 리소스 전체 교체.
   * @returns envelope의 `data` — 응답에 data가 없으면 `T = void`로 호출
   * @throws {ApiError}
   */
  put: <T>({
    path,
    body,
    headers,
    config,
  }: {
    path: string;
    body?: unknown;
    headers?: FetcherHeaders;
    config?: FetcherConfig;
  }) =>
    client.put<ApiResponse<T>>(path, body, { ...config, headers }).then(unwrap),
  /**
   * PATCH 요청 — 리소스 부분 수정.
   * @returns envelope의 `data` — 응답에 data가 없으면 `T = void`로 호출
   * @throws {ApiError}
   */
  patch: <T>({
    path,
    body,
    headers,
    config,
  }: {
    path: string;
    body?: unknown;
    headers?: FetcherHeaders;
    config?: FetcherConfig;
  }) =>
    client
      .patch<ApiResponse<T>>(path, body, { ...config, headers })
      .then(unwrap),
  /**
   * DELETE 요청.
   * @returns envelope의 `data` — 대부분 `T = void`로 호출
   * @throws {ApiError}
   * @example
   * await api.delete<void>({ path: `/reservations/${id}` });
   */
  delete: <T>({
    path,
    headers,
    config,
  }: {
    path: string;
    headers?: FetcherHeaders;
    config?: FetcherConfig;
  }) =>
    client.delete<ApiResponse<T>>(path, { ...config, headers }).then(unwrap),
};
