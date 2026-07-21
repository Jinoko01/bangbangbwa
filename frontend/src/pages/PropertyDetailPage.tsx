import { useState, type ComponentProps, type ReactNode } from "react";
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Heart,
  Pencil,
  Trash2,
} from "lucide-react";
import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperInstance } from "swiper";
import "swiper/css";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice, formatPriceLabel, toPyeong } from "@/lib/format";
import { cn } from "@/lib/utils";
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

// PROP-08·09 중개사 전용 수정·삭제 — 삭제는 확인 다이얼로그를 거친다
function BrokerActions({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <div className="ml-auto flex items-center gap-1">
      <Button variant="outline" size="sm" onClick={onEdit}>
        <Pencil />
        수정
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="text-destructive hover:bg-destructive/5 hover:text-destructive"
        onClick={() => setDeleteOpen(true)}
      >
        <Trash2 />
        삭제
      </Button>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>매물을 삭제하시겠어요?</DialogTitle>
            <DialogDescription>
              삭제하면 매물 정보와 연결된 예약, 세입자가 저장한 매물에서 함께
              사라지며 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              취소
            </Button>
            <Button variant="destructive" onClick={onDelete}>
              삭제하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface PhotoCarouselProps {
  title: string;
  imageUrls: string[];
  onPhotoClick: (url: string) => void;
}

// 매물 사진 인라인 캐러셀 — 스와이프·좌우 버튼으로 넘기고, 사진 클릭 시 크게 보기
function PhotoCarousel({ title, imageUrls, onPhotoClick }: PhotoCarouselProps) {
  const [swiper, setSwiper] = useState<SwiperInstance | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div className="relative">
      {/* loop: 마지막 사진에서 다음 → 첫 사진, 첫 사진에서 이전 → 마지막 사진 */}
      <Swiper
        loop={imageUrls.length > 1}
        onSwiper={setSwiper}
        onSlideChange={(instance) => setActiveIndex(instance.realIndex)}
      >
        {imageUrls.map((url, index) => (
          <SwiperSlide key={url}>
            <button
              type="button"
              className="block w-full cursor-zoom-in"
              aria-label={`${title} 사진 ${index + 1} 크게 보기`}
              onClick={() => onPhotoClick(url)}
            >
              <img
                src={url}
                alt={`${title} 사진 ${index + 1}`}
                className="h-64 w-full object-cover"
              />
            </button>
          </SwiperSlide>
        ))}
      </Swiper>
      <Button
        variant="secondary"
        size="icon"
        className="absolute top-1/2 left-2 z-10 -translate-y-1/2 rounded-full opacity-80 hover:opacity-100"
        aria-label="이전 사진"
        onClick={() => swiper?.slidePrev()}
      >
        <ChevronLeft />
      </Button>
      <Button
        variant="secondary"
        size="icon"
        className="absolute top-1/2 right-2 z-10 -translate-y-1/2 rounded-full opacity-80 hover:opacity-100"
        aria-label="다음 사진"
        onClick={() => swiper?.slideNext()}
      >
        <ChevronRight />
      </Button>
      <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
        {imageUrls.map((url, index) => (
          <button
            key={url}
            type="button"
            aria-label={`${index + 1}번째 사진 보기`}
            aria-current={index === activeIndex}
            className={cn(
              "size-2 rounded-full transition-colors",
              index === activeIndex
                ? "bg-white"
                : "bg-white/50 hover:bg-white/70",
            )}
            onClick={() => swiper?.slideToLoop(index)}
          />
        ))}
      </div>
    </div>
  );
}

interface PhotoDialogProps {
  title: string;
  photoUrl: string | null;
  onClose: () => void;
}

// 캐러셀에서 클릭한 사진 한 장을 크게 보여주는 모달
function PhotoDialog({ title, photoUrl, onClose }: PhotoDialogProps) {
  return (
    <Dialog
      open={photoUrl !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      {/* 기본 grid 레이아웃에선 원본 크기 이미지가 트랙을 밀어내므로 flex로 폭을 고정 */}
      <DialogContent className="flex flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>매물 사진</DialogTitle>
          <DialogDescription className="sr-only">
            {title} 사진을 크게 보여줍니다.
          </DialogDescription>
        </DialogHeader>
        {photoUrl && (
          <img
            src={photoUrl}
            alt={`${title} 사진 크게 보기`}
            className="max-h-[70svh] w-full rounded-lg object-contain"
          />
        )}
      </DialogContent>
    </Dialog>
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
  canManage: boolean;
  onBack: () => void;
  onToggleSave: (id: number) => void;
  onReserve: (id: number) => void;
  onEdit: () => void;
  onDelete: () => void;
  memos: Memo[];
  onAddMemo: (text: string) => void;
  onUpdateMemo: (memoId: number, text: string) => void;
  onDeleteMemo: (memoId: number) => void;
}

// PAGE-05 매물 상세 — 매물 정보(PROP-03), 저장(PROP-04·05), 예약, 메모(MEMO-01~04),
// 중개사 전용 수정·삭제(PROP-08·09)
function PropertyDetailPage({
  property,
  loading,
  canManage,
  onBack,
  onToggleSave,
  onReserve,
  onEdit,
  onDelete,
  memos,
  onAddMemo,
  onUpdateMemo,
  onDeleteMemo,
}: PropertyDetailPageProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const priceLabel = property
    ? { 매매: "매매가", 전세: "전세 보증금", 월세: "보증금 / 월세" }[
        property.dealType
      ]
    : "";

  const photoUrls =
    property?.imageUrls ?? (property?.imageUrl ? [property.imageUrl] : []);

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
          {canManage && property && (
            <BrokerActions onEdit={onEdit} onDelete={onDelete} />
          )}
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
              {photoUrls.length > 0 ? (
                <PhotoCarousel
                  title={property.title}
                  imageUrls={photoUrls}
                  onPhotoClick={setSelectedPhoto}
                />
              ) : (
                <img
                  src={property.imageUrl}
                  alt={`${property.title} 매물 사진`}
                  className="h-64 w-full object-cover"
                />
              )}
              <CardHeader className="pt-4">
                <div className="flex items-center gap-1.5">
                  <Badge>{property.dealType}</Badge>
                  <Badge variant="secondary">{property.buildingType}</Badge>
                </div>
                <CardTitle className="text-xl">{property.title}</CardTitle>
              </CardHeader>
              <CardContent className="pb-6">
                <p className="text-3xl font-bold text-primary">
                  {formatPriceLabel(property)}
                </p>
                <dl className="mt-4 divide-y">
                  <InfoRow label={priceLabel}>{formatPrice(property)}</InfoRow>
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

            <PhotoDialog
              title={property.title}
              photoUrl={selectedPhoto}
              onClose={() => setSelectedPhoto(null)}
            />
          </>
        )}
      </main>
    </div>
  );
}

export default PropertyDetailPage;
