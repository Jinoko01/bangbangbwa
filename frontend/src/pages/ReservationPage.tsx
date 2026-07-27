import { useMemo, useState } from "react";
import {
  CalendarClock,
  Check,
  CheckCircle2,
  Clock3,
  Home,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Video,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import ReservationChecklist from "@/components/ReservationChecklist";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useReservationChecklist } from "@/hooks/useReservationChecklist";
import { cn } from "@/lib/utils";
import type { Property, Reservation } from "@/types";

interface ReservationPageProps {
  reservations: Reservation[];
  properties: Property[];
  onConfirmReservation: (reservationId: string, time: string) => void;
}

// 모바일 예약 목록 한 페이지에 보여줄 예약 수
const MOBILE_PAGE_SIZE = 3;

function ReservationStatusBadge({ status }: Pick<Reservation, "status">) {
  const confirmed = status === "예약 확정";

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 px-2 py-0.5 font-medium",
        confirmed
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-amber-200 bg-amber-50 text-amber-700",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 rounded-full",
          confirmed ? "bg-emerald-500" : "bg-amber-500",
        )}
      />
      {status}
    </Badge>
  );
}

function getReservationTime(reservation: Reservation) {
  const time =
    reservation.status === "예약 확정"
      ? reservation.time
      : ([...reservation.timeOptions].sort()[0] ??
        reservation.time.split(",")[0].trim());

  return new Date(`${reservation.date}T${time}:00`).getTime();
}

function sortByNearest(first: Reservation, second: Reservation) {
  const now = Date.now();
  const firstTime = getReservationTime(first);
  const secondTime = getReservationTime(second);
  const firstIsUpcoming = firstTime >= now;
  const secondIsUpcoming = secondTime >= now;

  if (firstIsUpcoming !== secondIsUpcoming) {
    return firstIsUpcoming ? -1 : 1;
  }

  return firstIsUpcoming ? firstTime - secondTime : secondTime - firstTime;
}

function ReservationConfirmation({
  reservation,
  onConfirm,
}: {
  reservation: Reservation;
  onConfirm: (time: string) => void;
}) {
  const options = reservation.timeOptions.length
    ? reservation.timeOptions
    : reservation.time.split(",").map((time) => time.trim());
  const [selectedTime, setSelectedTime] = useState(options[0]);

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/[0.03] p-4">
      <p className="font-semibold">예약 시간을 선택해 주세요</p>
      <p className="mt-1 text-xs text-muted-foreground">
        요청자가 보낸 후보 중 가능한 시간을 하나 선택하면 예약이 확정됩니다.
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {options.map((time) => (
          <Button
            key={time}
            type="button"
            variant={selectedTime === time ? "default" : "outline"}
            aria-pressed={selectedTime === time}
            onClick={() => setSelectedTime(time)}
          >
            <Clock3 /> {time}
          </Button>
        ))}
      </div>
      <Button
        className="mt-3 w-full"
        disabled={!selectedTime}
        onClick={() => selectedTime && onConfirm(selectedTime)}
      >
        <Check /> 이 시간으로 예약 확정
      </Button>
    </div>
  );
}

function ReservationPage({
  reservations,
  properties,
  onConfirmReservation,
}: ReservationPageProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<"sent" | "received" | "all">(
    "all",
  );
  const [page, setPage] = useState(1);
  const filteredReservations = useMemo(() => {
    const visibleReservations =
      activeTab === "all"
        ? reservations
        : reservations.filter(
            (reservation) => reservation.direction === activeTab,
          );

    return [...visibleReservations].sort(sortByNearest);
  }, [activeTab, reservations]);
  const [selectedId, setSelectedId] = useState(
    filteredReservations[0]?.id ?? "",
  );
  // 목록이 줄어 현재 페이지가 사라졌을 때를 대비해 마지막 페이지로 보정
  const pageCount = Math.ceil(filteredReservations.length / MOBILE_PAGE_SIZE);
  const currentPage = Math.min(page, Math.max(pageCount, 1));
  const pagedReservations = isMobile
    ? filteredReservations.slice(
        (currentPage - 1) * MOBILE_PAGE_SIZE,
        currentPage * MOBILE_PAGE_SIZE,
      )
    : filteredReservations;

  const selectedReservation =
    filteredReservations.find((reservation) => reservation.id === selectedId) ??
    filteredReservations[0];
  const selectedProperty = properties.find(
    (property) => property.id === selectedReservation?.propertyId,
  );
  const { items: selectedChecklist, setItems: setSelectedChecklist } =
    useReservationChecklist(selectedReservation?.id);

  return (
    <main className="min-h-[calc(100svh-3.5rem)] bg-white">
      <section className="border-b bg-slate-50/70">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-xl font-semibold">예약 확인</h1>
            <p className="text-xs text-muted-foreground">
              미팅 일정, 매물 정보, 입장 준비 상태
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="hidden sm:flex">
              <ShieldCheck /> 확정 예약{" "}
              {
                reservations.filter(
                  (reservation) => reservation.status === "예약 확정",
                ).length
              }
              건
            </Badge>
            <Button variant="outline" size="sm">
              <RefreshCw /> 새로고침
            </Button>
            <Button size="sm" onClick={() => navigate("/properties")}>
              새 미팅 예약
            </Button>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 pt-4">
        <div className="inline-flex rounded-xl bg-slate-100 p-1">
          {(["all", "sent", "received"] as const).map((tab) => {
            const count =
              tab === "all"
                ? reservations.length
                : reservations.filter(
                    (reservation) => reservation.direction === tab,
                  ).length;
            return (
              <button
                key={tab}
                type="button"
                className={cn(
                  "rounded-lg px-5 py-2 text-sm transition-colors",
                  activeTab === tab
                    ? "bg-white font-semibold text-primary shadow-sm"
                    : "text-muted-foreground",
                )}
                onClick={() => {
                  setActiveTab(tab);
                  setPage(1);
                }}
              >
                {tab === "sent"
                  ? "보낸 예약"
                  : tab === "received"
                    ? "받은 예약"
                    : "모든 예약"}{" "}
                {count}
              </button>
            );
          })}
        </div>
      </div>

      {filteredReservations.length === 0 || !selectedProperty ? (
        <div className="mx-auto max-w-7xl px-4 py-20 text-center">
          <CalendarClock className="mx-auto size-10 text-muted-foreground" />
          <h2 className="mt-4 font-semibold">아직 예약한 미팅이 없습니다</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeTab === "sent"
              ? "매물 목록에서 원하는 매물의 미팅을 예약해 보세요."
              : activeTab === "received"
                ? "아직 중개사에게 받은 예약이 없습니다."
                : "아직 등록된 예약이 없습니다."}
          </p>
          <Button className="mt-5" onClick={() => navigate("/properties")}>
            매물 둘러보기
          </Button>
        </div>
      ) : (
        <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 lg:grid-cols-[260px_minmax(0,1fr)_350px] xl:grid-cols-[280px_minmax(0,1fr)_370px]">
          <Card className="gap-3 py-4">
            <CardHeader className="flex-row items-center justify-between px-4">
              <CardTitle className="text-base">예약 목록</CardTitle>
              <Badge variant="secondary">{filteredReservations.length}건</Badge>
            </CardHeader>
            <CardContent className="space-y-2 px-4">
              {pagedReservations.map((reservation) => {
                const property = properties.find(
                  (item) => item.id === reservation.propertyId,
                );
                if (!property) {
                  return null;
                }
                const isSelected = reservation.id === selectedReservation.id;
                return (
                  <button
                    key={reservation.id}
                    type="button"
                    className={cn(
                      "w-full rounded-xl border p-3 text-left transition-colors",
                      isSelected
                        ? "border-primary bg-primary/[0.04]"
                        : "bg-slate-50 hover:bg-slate-100",
                    )}
                    onClick={() => setSelectedId(reservation.id)}
                  >
                    <div className="flex items-center">
                      <strong className="truncate text-sm">
                        {property.title}
                      </strong>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <ReservationStatusBadge status={reservation.status} />
                      {activeTab === "all" && (
                        <Badge variant="outline">
                          {reservation.direction === "sent"
                            ? "보낸 예약"
                            : "받은 예약"}
                        </Badge>
                      )}
                      <span className="text-xs font-medium text-primary">
                        {reservation.time}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {reservation.date} · 온라인 미팅
                    </p>
                  </button>
                );
              })}
              {isMobile && pageCount > 1 && (
                <nav
                  className="flex items-center justify-center gap-1 pt-1"
                  aria-label="예약 목록 페이지"
                >
                  {Array.from(
                    { length: pageCount },
                    (_, index) => index + 1,
                  ).map((pageNumber) => (
                    <Button
                      key={pageNumber}
                      type="button"
                      size="sm"
                      variant={pageNumber === currentPage ? "default" : "ghost"}
                      className="size-8 p-0"
                      aria-current={
                        pageNumber === currentPage ? "page" : undefined
                      }
                      onClick={() => setPage(pageNumber)}
                    >
                      {pageNumber}
                    </Button>
                  ))}
                </nav>
              )}
            </CardContent>
          </Card>

          <Card className="gap-3 py-4">
            <CardHeader className="flex-row items-start justify-between px-4">
              <div>
                <CardTitle className="text-base">미팅 상세</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  일정과 매물 정보를 확인하세요
                </p>
              </div>
              <ReservationStatusBadge status={selectedReservation.status} />
            </CardHeader>
            <CardContent className="space-y-4 px-4">
              <div className="grid overflow-hidden rounded-xl border sm:grid-cols-[220px_1fr]">
                <img
                  src={selectedProperty.imageUrl}
                  alt={`${selectedProperty.title} 매물 사진`}
                  className="h-44 w-full object-cover sm:h-full"
                />
                <div className="relative p-4">
                  <span className="absolute right-4 top-4 text-xs text-muted-foreground">
                    예약번호{" "}
                    <strong className="ml-1 text-foreground">
                      {selectedReservation.id.slice(-8)}
                    </strong>
                  </span>
                  <div className="flex gap-2 pr-32">
                    <Badge variant="secondary">
                      {selectedProperty.dealType}
                    </Badge>
                    <Badge variant="outline">
                      {selectedProperty.buildingType}
                    </Badge>
                  </div>
                  <h2 className="mt-3 text-lg font-semibold">
                    {selectedProperty.title}
                  </h2>
                  <p className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="size-4" /> {selectedProperty.region}{" "}
                    {selectedProperty.dong}
                  </p>
                  <p className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
                    <Home className="size-4" /> {selectedProperty.areaM2}㎡ · 방{" "}
                    {selectedProperty.rooms}개 · {selectedProperty.floor}층
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 overflow-hidden rounded-xl border text-sm">
                <div className="border-b border-r bg-slate-50 p-3 text-muted-foreground">
                  예약 날짜
                </div>
                <div className="border-b p-3 font-semibold">
                  {selectedReservation.date}
                </div>
                <div className="border-r bg-slate-50 p-3 text-muted-foreground">
                  미팅 시간
                </div>
                <div className="p-3 font-semibold text-primary">
                  {selectedReservation.time} · 약 30분
                </div>
              </div>

              {selectedReservation.direction === "received" &&
                selectedReservation.status === "예약 대기" && (
                  <ReservationConfirmation
                    key={selectedReservation.id}
                    reservation={selectedReservation}
                    onConfirm={(time) =>
                      onConfirmReservation(selectedReservation.id, time)
                    }
                  />
                )}

              {selectedReservation.status === "예약 확정" && (
                <div className="rounded-xl border bg-slate-50/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      <CheckCircle2 className="size-5 text-emerald-600" /> 예약
                      상태
                    </p>
                    <ReservationStatusBadge
                      status={selectedReservation.status}
                    />
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    중개사와 일정이 확정되었습니다.
                    <br />
                    시작 10분 전부터 입장할 수 있어요.
                  </p>
                  <div className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-[1fr_auto] sm:items-end">
                    <div className="grid grid-cols-[70px_1fr] gap-y-2 text-xs">
                      <span className="text-muted-foreground">형식</span>
                      <strong>실시간 영상 투어</strong>
                      <span className="text-muted-foreground">소요시간</span>
                      <strong>약 30분</strong>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() =>
                          navigate(`/reservation/${selectedReservation.id}`)
                        }
                      >
                        <Video /> 미팅 입장
                      </Button>
                      {selectedReservation.direction === "sent" && (
                        <Button
                          variant="outline"
                          onClick={() =>
                            navigate(`/booking/${selectedProperty.id}`)
                          }
                        >
                          <Clock3 /> 일정 변경
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="gap-3 py-4">
            <CardContent className="px-4">
              <ReservationChecklist
                items={selectedChecklist}
                onChange={setSelectedChecklist}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  );
}

export default ReservationPage;
