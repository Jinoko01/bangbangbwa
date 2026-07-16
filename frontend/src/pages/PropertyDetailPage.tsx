import { useState, type ComponentProps, type ReactNode } from "react";
import { CalendarPlus, ChevronLeft, Heart, Pencil, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice, toPyeong } from "@/lib/format";
import type { Memo, Property } from "@/types";

// shadcn Textarea 미설치 → Input과 동일 토큰으로 스타일링한 로컬 textarea
function MemoTextarea(props: ComponentProps<"textarea">) {
  return (
    <textarea
      className="min-h-20 w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      {...props}
    />
  );
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2.5 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

function formatMemoDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface MemoSectionProps {
  memos: Memo[];
  onAdd: (text: string) => void;
  onUpdate: (memoId: number, text: string) => void;
  onDelete: (memoId: number) => void;
}

// MEMO-01~04: 메모 작성·조회·수정·삭제
function MemoSection({ memos, onAdd, onUpdate, onDelete }: MemoSectionProps) {
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  const submitDraft = () => {
    const text = draft.trim();
    if (!text) {
      return;
    }
    onAdd(text);
    setDraft("");
  };

  const startEdit = (memo: Memo) => {
    setEditingId(memo.id);
    setEditText(memo.text);
  };

  const submitEdit = () => {
    const text = editText.trim();
    if (!text || editingId === null) {
      return;
    }
    onUpdate(editingId, text);
    setEditingId(null);
  };

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>메모</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {memos.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            작성한 메모가 없습니다.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {memos.map((memo) => (
              <li key={memo.id} className="rounded-lg border bg-muted/40 p-3">
                {editingId === memo.id ? (
                  <div className="flex flex-col gap-2">
                    <MemoTextarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      aria-label="메모 수정"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingId(null)}
                      >
                        취소
                      </Button>
                      <Button
                        size="sm"
                        onClick={submitEdit}
                        disabled={!editText.trim()}
                      >
                        저장
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm whitespace-pre-wrap">{memo.text}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {formatMemoDate(memo.createdAt)}
                      </span>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          aria-label="메모 수정"
                          onClick={() => startEdit(memo)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive hover:text-destructive"
                          aria-label="메모 삭제"
                          onClick={() => onDelete(memo.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-2">
          <MemoTextarea
            placeholder="이 매물에 대한 메모를 남겨보세요"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="메모 작성"
          />
          <Button
            className="self-end"
            size="sm"
            onClick={submitDraft}
            disabled={!draft.trim()}
          >
            메모 작성
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Card className="gap-4">
        <CardHeader>
          <Skeleton className="h-5 w-28" />
          <Skeleton className="mt-2 h-7 w-1/2" />
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </CardContent>
      </Card>
    </div>
  );
}

interface PropertyDetailPageProps {
  property: Property | null;
  loading: boolean;
  onBack: () => void;
  onToggleSave: (id: number) => void;
  onReserve: (id: number) => void;
  memos: Memo[];
  onAddMemo: (text: string) => void;
  onUpdateMemo: (memoId: number, text: string) => void;
  onDeleteMemo: (memoId: number) => void;
}

// PAGE-05 매물 상세 — 매물 정보(PROP-03), 저장(PROP-04·05), 예약, 메모(MEMO-01~04)
function PropertyDetailPage({
  property,
  loading,
  onBack,
  onToggleSave,
  onReserve,
  memos,
  onAddMemo,
  onUpdateMemo,
  onDeleteMemo,
}: PropertyDetailPageProps) {
  const priceLabel = property
    ? { 매매: "매매가", 전세: "전세 보증금", 월세: "보증금 / 월세" }[
        property.dealType
      ]
    : "";

  return (
    <div className="min-h-svh bg-background">
      {/* top-14: 공통 GNB(h-14) 아래에 고정 */}
      <header className="sticky top-14 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            aria-label="목록으로"
            onClick={onBack}
          >
            <ChevronLeft />
          </Button>
          <h1 className="text-lg font-semibold">매물 상세</h1>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
        {loading ? (
          <DetailSkeleton />
        ) : !property ? (
          <div className="flex flex-col items-center gap-3 py-24 text-center">
            <p className="font-medium">매물을 찾을 수 없습니다</p>
            <Button variant="outline" size="sm" onClick={onBack}>
              목록으로 돌아가기
            </Button>
          </div>
        ) : (
          <>
            <Card className="gap-0 overflow-hidden py-0">
              <img
                src={property.imageUrl}
                alt={`${property.title} 매물 사진`}
                className="h-64 w-full object-cover"
              />
              <CardHeader>
                <div className="flex items-center gap-1.5">
                  <Badge>{property.dealType}</Badge>
                  <Badge variant="secondary">{property.buildingType}</Badge>
                </div>
                <CardTitle className="text-xl">{property.title}</CardTitle>
              </CardHeader>
              <CardContent className="pb-6">
                <p className="text-3xl font-bold text-primary">
                  {formatPrice(property)}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    만원
                  </span>
                </p>
                <dl className="mt-4 divide-y">
                  <InfoRow label={priceLabel}>
                    {formatPrice(property)} 만원
                  </InfoRow>
                  <InfoRow label="위치">
                    {property.region} {property.dong}
                  </InfoRow>
                  <InfoRow label="전용면적">
                    {property.areaM2}㎡ ({toPyeong(property.areaM2)}평)
                  </InfoRow>
                  <InfoRow label="층수">
                    {property.floor}층 / 전체 {property.totalFloors}층
                  </InfoRow>
                  <InfoRow label="방 개수">방{property.rooms}</InfoRow>
                </dl>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="h-11 flex-1"
                aria-pressed={property.saved}
                onClick={() => onToggleSave(property.id)}
              >
                <Heart
                  className={
                    property.saved
                      ? "fill-primary text-primary"
                      : "text-muted-foreground"
                  }
                />
                {property.saved ? "저장됨" : "저장"}
              </Button>
              <Button
                className="h-11 flex-1"
                onClick={() => onReserve(property.id)}
              >
                <CalendarPlus />
                미팅 예약
              </Button>
            </div>

            <MemoSection
              memos={memos}
              onAdd={onAddMemo}
              onUpdate={onUpdateMemo}
              onDelete={onDeleteMemo}
            />
          </>
        )}
      </main>
    </div>
  );
}

export default PropertyDetailPage;
