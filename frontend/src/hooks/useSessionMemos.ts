import { useEffect, useState } from "react";

import { readStoredJson, writeStoredJson } from "@/lib/storage";
import type { Memo } from "@/types";

const SESSION_MEMO_STORAGE_KEY = "bangbangbwa:session-memos";

type SessionMemos = Record<string, Memo[]>;

// 라이브 세션 중 본인만 볼 수 있는 메모를 예약별로 보관한다
export function useSessionMemos(reservationId: string | undefined) {
  const [memosByReservation, setMemosByReservation] = useState<SessionMemos>(
    () => readStoredJson<SessionMemos>(SESSION_MEMO_STORAGE_KEY, {}),
  );

  useEffect(() => {
    writeStoredJson(SESSION_MEMO_STORAGE_KEY, memosByReservation);
  }, [memosByReservation]);

  const memos = reservationId ? (memosByReservation[reservationId] ?? []) : [];

  const replaceMemos = (update: (current: Memo[]) => Memo[]) => {
    if (!reservationId) {
      return;
    }
    setMemosByReservation((current) => ({
      ...current,
      [reservationId]: update(current[reservationId] ?? []),
    }));
  };

  const addMemo = (text: string) =>
    replaceMemos((current) => [
      ...current,
      { id: Date.now(), text, createdAt: new Date().toISOString() },
    ]);

  const updateMemo = (memoId: number, text: string) =>
    replaceMemos((current) =>
      current.map((memo) => (memo.id === memoId ? { ...memo, text } : memo)),
    );

  const removeMemo = (memoId: number) =>
    replaceMemos((current) => current.filter((memo) => memo.id !== memoId));

  return { memos, addMemo, updateMemo, removeMemo };
}
