import { useEffect, useState } from "react";
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
import { useReservationChecklist } from "@/hooks/useReservationChecklist";
import { cn } from "@/lib/utils";
import type { Property, Reservation } from "@/types";

interface ReservationPageProps {
  reservations: Reservation[];
  properties: Property[];
}

function ReservationPage({ reservations, properties }: ReservationPageProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"sent" | "received">("sent");
  const filteredReservations = reservations.filter(
    (reservation) => reservation.direction === activeTab,
  );
  const [selectedId, setSelectedId] = useState(
    filteredReservations[0]?.id ?? "",
  );

  useEffect(() => {
    const selectionExists = filteredReservations.some(
      (reservation) => reservation.id === selectedId,
    );
    if (!selectionExists) {
      setSelectedId(filteredReservations[0]?.id ?? "");
    }
  }, [filteredReservations, selectedId]);

  const selectedReservation =
    filteredReservations.find((reservation) => reservation.id === selectedId) ??
    filteredReservations[0];
  const selectedProperty = properties.find(
    (property) => property.id === selectedReservation?.propertyId,
  );
  const { items: selectedChecklist, setItems: setSelectedChecklist } =
    useReservationChecklist(selectedReservation?.id);
  const reservationStatusMessage =
    selectedReservation?.status === "예약 확정"
      ? "중개사와 일정이 확정되었습니다. 시작 10분 전부터 입장할 수 있어요."
      : "중개사가 예약 일정을 확인하고 있어요. 확정 후 미팅에 입장할 수 있어요.";

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
              <ShieldCheck /> 확정 예약 {reservations.length}건
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
          {(["sent", "received"] as const).map((tab) => {
            const count = reservations.filter(
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
                onClick={() => setActiveTab(tab)}
              >
                {tab === "sent" ? "보낸 예약" : "받은 예약"} {count}
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
              : "아직 중개사에게 받은 예약이 없습니다."}
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
              {filteredReservations.map((reservation) => {
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
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "grid size-4 place-items-center rounded border",
                          isSelected &&
                            "border-primary bg-primary text-primary-foreground",
                        )}
                      >
                        {isSelected && <Check className="size-3" />}
                      </span>
                      <strong className="truncate text-sm">
                        {property.title}
                      </strong>
                    </div>
                    <p className="mt-2 text-xs font-medium text-primary">
                      {reservation.status} · {reservation.time}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {reservation.date} · 온라인 미팅
                    </p>
                  </button>
                );
              })}
              <div className="rounded-xl border bg-slate-50 p-3">
                <p className="text-xs font-semibold">오늘 일정 요약</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {activeTab === "sent" ? "보낸" : "받은"} 예약{" "}
                  {filteredReservations.length}건
                </p>
              </div>
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
              <Badge>{selectedReservation.status}</Badge>
            </CardHeader>
            <CardContent className="space-y-4 px-4">
              <div className="grid overflow-hidden rounded-xl border sm:grid-cols-[220px_1fr]">
                <img
                  src={selectedProperty.imageUrl}
                  alt={`${selectedProperty.title} 매물 사진`}
                  className="h-44 w-full object-cover sm:h-full"
                />
                <div className="p-4">
                  <div className="flex gap-2">
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

              <div className="rounded-xl border bg-slate-50/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <CheckCircle2 className="size-5 text-emerald-600" /> 예약
                    상태
                  </p>
                  <Badge>{selectedReservation.status}</Badge>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {reservationStatusMessage}
                </p>
                <div className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div className="grid grid-cols-[70px_1fr] gap-y-2 text-xs">
                    <span className="text-muted-foreground">예약번호</span>
                    <strong>{selectedReservation.id.slice(-8)}</strong>
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
                    <Button
                      variant="outline"
                      onClick={() =>
                        navigate(`/booking/${selectedProperty.id}`)
                      }
                    >
                      <Clock3 /> 일정 변경
                    </Button>
                  </div>
                </div>
              </div>
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
