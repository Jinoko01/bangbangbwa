import { useCallback, useEffect, useState } from "react";

import { readStoredJson, writeStoredJson } from "@/lib/storage";
import type { ChecklistItem } from "@/types";

const CHECKLIST_STORAGE_KEY = "bangbangbwa:reservation-checklists";
const DEFAULT_CHECKLIST_TEXTS = [
  "벽지·천장 곰팡이 확인",
  "등기부등본 근저당 확인",
];

type ReservationChecklists = Record<string, ChecklistItem[]>;

function createDefaultChecklist(): ChecklistItem[] {
  return DEFAULT_CHECKLIST_TEXTS.map((text, index) => ({
    id: `default-${index}`,
    text,
    completed: false,
  }));
}

// 예약별 체크리스트를 브라우저에 보관하고, 선택한 예약의 항목만 노출한다
export function useReservationChecklist(reservationId: string | undefined) {
  const [checklists, setChecklists] = useState<ReservationChecklists>(() =>
    readStoredJson<ReservationChecklists>(CHECKLIST_STORAGE_KEY, {}),
  );

  useEffect(() => {
    writeStoredJson(CHECKLIST_STORAGE_KEY, checklists);
  }, [checklists]);

  const setItems = useCallback(
    (items: ChecklistItem[]) => {
      if (!reservationId) {
        return;
      }
      setChecklists((current) => ({ ...current, [reservationId]: items }));
    },
    [reservationId],
  );

  const items = reservationId
    ? (checklists[reservationId] ?? createDefaultChecklist())
    : [];

  return { items, setItems };
}
