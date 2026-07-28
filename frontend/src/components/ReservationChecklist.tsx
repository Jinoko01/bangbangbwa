import { type FormEvent, useState } from "react";
import { CheckCircle2, Circle, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAX_CHECKLIST_ITEMS } from "@/hooks/useReservationChecklist";
import { cn } from "@/lib/utils";
import type { ChecklistItem } from "@/types";

interface ReservationChecklistProps {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
  // bare — 이미 제목이 있는 탭·패널 안에 들어갈 때 카드 껍데기와 제목을 뺀다
  variant?: "card" | "bare";
}

function ReservationChecklist({
  items,
  onChange,
  variant = "card",
}: ReservationChecklistProps) {
  const isBare = variant === "bare";
  const [draft, setDraft] = useState("");
  const completedCount = items.filter((item) => item.completed).length;
  const reachedItemLimit = items.length >= MAX_CHECKLIST_ITEMS;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || reachedItemLimit) {
      return;
    }
    onChange([...items, { id: crypto.randomUUID(), text, completed: false }]);
    setDraft("");
  };

  const toggleItem = (itemId: string) => {
    onChange(
      items.map((item) =>
        item.id === itemId ? { ...item, completed: !item.completed } : item,
      ),
    );
  };

  const removeItem = (itemId: string) => {
    onChange(items.filter((item) => item.id !== itemId));
  };

  return (
    <div className={cn(!isBare && "rounded-xl border bg-slate-50/70 p-4")}>
      {!isBare && (
        <div className="flex items-start justify-between gap-3">
          <div>
            <strong className="text-sm text-slate-900">예약 체크리스트</strong>
            <p className="mt-1 text-xs text-muted-foreground">
              통화 중 확인할 내용을 적고, 확인한 항목을 체크하세요.
            </p>
          </div>
          <Badge variant="secondary">
            {completedCount}/{items.length} · 최대 {MAX_CHECKLIST_ITEMS}개
          </Badge>
        </div>
      )}

      {items.length === 0 ? (
        <p
          className={cn(
            "rounded-lg border border-dashed bg-white px-3 py-6 text-center text-xs text-muted-foreground",
            !isBare && "mt-4",
          )}
        >
          아직 체크리스트 항목이 없습니다. 아래에서 추가하세요.
        </p>
      ) : (
        <ul className={cn("space-y-2", !isBare && "mt-4")}>
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2.5"
            >
              <button
                type="button"
                className="shrink-0 text-primary"
                aria-label={`${item.text} ${item.completed ? "미완료로 변경" : "완료로 변경"}`}
                onClick={() => toggleItem(item.id)}
              >
                {item.completed ? (
                  <CheckCircle2 className="size-5" />
                ) : (
                  <Circle className="size-5" />
                )}
              </button>
              <span
                className={cn(
                  "min-w-0 flex-1 text-sm break-words",
                  item.completed && "text-muted-foreground line-through",
                )}
              >
                {item.text}
              </span>
              <button
                type="button"
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600"
                aria-label={`${item.text} 삭제`}
                onClick={() => removeItem(item.id)}
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form className="mt-3 flex gap-2" onSubmit={handleSubmit}>
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={
            reachedItemLimit
              ? "체크리스트는 최대 20개까지 작성할 수 있습니다"
              : "확인할 내용이나 질문을 입력하세요"
          }
          aria-label="체크리스트 항목"
          disabled={reachedItemLimit}
          className="h-10 min-w-0 flex-1 bg-white placeholder:text-xs"
          maxLength={60}
        />
        <Button
          type="submit"
          size="sm"
          className="h-10 shrink-0"
          disabled={reachedItemLimit || !draft.trim()}
        >
          <Plus /> 추가
        </Button>
      </form>
      {reachedItemLimit && (
        <p className="mt-2 text-xs text-muted-foreground" role="status">
          최대 작성 개수에 도달했습니다. 새 항목을 추가하려면 기존 항목을 삭제해
          주세요.
        </p>
      )}
    </div>
  );
}

export default ReservationChecklist;
