import { useCallback, useEffect, useMemo, useState } from "react";

import { readStoredJson, writeStoredJson } from "@/lib/storage";
import type { ChecklistItem } from "@/types";

const CHECKLIST_STORAGE_PREFIX = "bangbangbwa:checklist";
export const MAX_CHECKLIST_ITEMS = 20;

interface ChecklistState {
  storageKey: string | null;
  items: ChecklistItem[];
}

// 사용자·매물별 체크리스트를 분리해 같은 브라우저의 다른 계정과 공유되지 않게 한다
export function useReservationChecklist(
  userId: number | undefined,
  propertyId: number | undefined,
) {
  const storageKey = useMemo(
    () =>
      userId !== undefined && propertyId !== undefined
        ? `${CHECKLIST_STORAGE_PREFIX}:user:${userId}:property:${propertyId}`
        : null,
    [propertyId, userId],
  );

  const [checklistState, setChecklistState] = useState<ChecklistState>(() => ({
    storageKey,
    items: storageKey
      ? readStoredJson<ChecklistItem[]>(storageKey, []).slice(
          0,
          MAX_CHECKLIST_ITEMS,
        )
      : [],
  }));

  // 같은 컴포넌트에서 계정이나 매물만 바뀌어도 해당 전용 저장소를 다시 읽는다.
  useEffect(() => {
    setChecklistState({
      storageKey,
      items: storageKey
        ? readStoredJson<ChecklistItem[]>(storageKey, []).slice(
            0,
            MAX_CHECKLIST_ITEMS,
          )
        : [],
    });
  }, [storageKey]);

  const setItems = useCallback(
    (items: ChecklistItem[]) => {
      if (!storageKey) {
        return;
      }
      const limitedItems = items.slice(0, MAX_CHECKLIST_ITEMS);
      writeStoredJson(storageKey, limitedItems);
      setChecklistState({
        storageKey,
        items: limitedItems,
      });
    },
    [storageKey],
  );

  // 저장 범위가 바뀐 직후 effect가 실행되기 전에도 이전 사용자의 항목을 노출하지 않는다.
  const items =
    checklistState.storageKey === storageKey ? checklistState.items : [];

  return { items, setItems };
}
