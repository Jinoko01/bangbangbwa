import { useSyncExternalStore } from "react";

const MOBILE_QUERY = "(max-width: 639px)"; // Tailwind sm(640px) 미만

function subscribeToMobileQuery(onChange: () => void) {
  const media = window.matchMedia(MOBILE_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

// 모바일 전용 UI 분기를 위한 뷰포트 구독
export function useIsMobile() {
  return useSyncExternalStore(
    subscribeToMobileQuery,
    () => window.matchMedia(MOBILE_QUERY).matches,
  );
}
