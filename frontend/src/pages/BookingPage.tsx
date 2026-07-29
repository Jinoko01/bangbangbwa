import { useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Home,
  MapPin,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Property, Reservation } from "@/types";

const HOURS = Array.from({ length: 15 }, (_, index) => index + 8);
const REQUIRED_TIME_COUNT = 3;

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function toDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCalendarDays(month: Date) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const lastDate = new Date(year, monthIndex + 1, 0).getDate();
  return [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from(
      { length: lastDate },
      (_, index) => new Date(year, monthIndex, index + 1),
    ),
  ];
}

interface BookingPageProps {
  properties: Property[];
  onConfirm: (reservation: Reservation) => void;
}

function BookingPage({ properties, onConfirm }: BookingPageProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const property = properties.find((item) => item.id === Number(id));
  const today = new Date();
  const [visibleMonth, setVisibleMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [selectedDate, setSelectedDate] = useState(toDateValue(today));
  const [selectedHours, setSelectedHours] = useState<number[]>([]);

  if (!property) {
    return (
      <div className="p-12 text-center">매물 정보를 찾을 수 없습니다.</div>
    );
  }

  const confirmReservation = () => {
    if (selectedHours.length !== REQUIRED_TIME_COUNT) {
      return;
    }
    const timeOptions = selectedHours.map(
      (hour) => `${String(hour).padStart(2, "0")}:00`,
    );
    // 회의 API 연동 전이라 로컬 예약에도 회의 id가 필요하다 — 생성 시각으로 임시 발급
    const mockMeetingId = Date.now();
    onConfirm({
      id: `reservation-${mockMeetingId}`,
      meetingId: mockMeetingId,
      propertyId: property.id,
      date: selectedDate,
      time: timeOptions.join(", "),
      timeOptions,
      status: "예약 대기",
      direction: "sent",
    });
    navigate("/reservations");
  };

  return (
    <main className="min-h-[calc(100svh-3.5rem)] bg-slate-50 px-4 py-4 lg:h-[calc(100svh-3.5rem)] lg:overflow-hidden">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <Badge variant="secondary">온라인 매물 투어</Badge>
            <h1 className="mt-2 text-2xl font-semibold">미팅 예약</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              달력에서 날짜를 고르고 원하는 시간을 선택하세요.
            </p>
          </div>
          <Button variant="ghost" onClick={() => navigate("/properties")}>
            목록으로 돌아가기
          </Button>
        </div>

        <Card className="mb-3 overflow-hidden py-0">
          <CardContent className="flex items-center gap-4 p-3">
            <img
              src={property.imageUrl}
              alt={`${property.title} 매물 사진`}
              className="h-20 w-32 rounded-lg object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Badge>{property.dealType}</Badge>
                <Badge variant="secondary">{property.buildingType}</Badge>
              </div>
              <h2 className="mt-2 font-semibold">{property.title}</h2>
              <div className="mt-1 flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="size-4" /> {property.region}{" "}
                  {property.dong}
                </span>
                <span className="flex items-center gap-1">
                  <Home className="size-4" /> {property.areaM2}㎡ · 방{" "}
                  {property.rooms}개
                </span>
              </div>
            </div>
            <div className="hidden text-right sm:block">
              <p className="text-xs text-muted-foreground">미팅 방식</p>
              <p className="mt-1 text-sm font-semibold">
                온라인 영상 투어 · 약 30분
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 lg:grid-cols-[1.05fr_1.35fr_0.8fr]">
          <Card className="gap-3 py-5">
            <CardHeader className="px-5">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="size-5 text-primary" /> 날짜 선택
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5">
              <div className="mb-3 flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="이전 달"
                  onClick={() =>
                    setVisibleMonth(
                      (month) =>
                        new Date(month.getFullYear(), month.getMonth() - 1, 1),
                    )
                  }
                >
                  <ChevronLeft />
                </Button>
                <strong className="text-sm">
                  {visibleMonth.getFullYear()}년 {visibleMonth.getMonth() + 1}월
                </strong>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="다음 달"
                  onClick={() =>
                    setVisibleMonth(
                      (month) =>
                        new Date(month.getFullYear(), month.getMonth() + 1, 1),
                    )
                  }
                >
                  <ChevronRight />
                </Button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center">
                {WEEKDAYS.map((weekday) => (
                  <span
                    key={weekday}
                    className="py-1 text-xs text-muted-foreground"
                  >
                    {weekday}
                  </span>
                ))}
                {getCalendarDays(visibleMonth).map((date, index) => {
                  if (!date) {
                    return <span key={`empty-${index}`} />;
                  }
                  const value = toDateValue(date);
                  const isPast = value < toDateValue(today);
                  return (
                    <button
                      key={value}
                      type="button"
                      disabled={isPast}
                      className={cn(
                        "aspect-square rounded-md text-xs transition-colors hover:bg-accent",
                        selectedDate === value &&
                          "bg-primary font-semibold text-primary-foreground hover:bg-primary",
                        isPast && "cursor-not-allowed text-muted-foreground/35",
                      )}
                      onClick={() => setSelectedDate(value)}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="gap-3 py-5">
            <CardHeader className="px-5">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <Clock3 className="size-5 text-primary" /> 시간 선택
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  08:00–22:00
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-2 px-5">
              {HOURS.map((hour) => {
                const selected = selectedHours.includes(hour);
                return (
                  <Button
                    key={hour}
                    variant={selected ? "default" : "outline"}
                    className="h-10"
                    onClick={() =>
                      setSelectedHours((previous) => {
                        if (selected) {
                          return previous.filter((item) => item !== hour);
                        }
                        if (previous.length === REQUIRED_TIME_COUNT) {
                          return previous;
                        }
                        return [...previous, hour];
                      })
                    }
                  >
                    {String(hour).padStart(2, "0")}:00
                  </Button>
                );
              })}
              <div className="col-span-3 mt-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>희망 시간 3개를 선택해 주세요.</span>
                <strong className="text-primary">
                  {selectedHours.length}/3 선택
                </strong>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/30 bg-primary/[0.03] py-5">
            <CardHeader className="px-5">
              <CardTitle className="text-base">예약 내용</CardTitle>
            </CardHeader>
            <CardContent className="flex h-full flex-col px-5">
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-muted-foreground">선택 날짜</p>
                  <p className="mt-1 font-semibold">
                    {new Intl.DateTimeFormat("ko-KR", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      weekday: "short",
                    }).format(new Date(`${selectedDate}T00:00:00`))}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">선택 시간</p>
                  <div className="mt-2 space-y-2">
                    {Array.from({ length: REQUIRED_TIME_COUNT }, (_, index) => (
                      <p
                        key={index}
                        className="rounded-lg border bg-white px-3 py-2 font-semibold text-primary"
                      >
                        {selectedHours[index] === undefined
                          ? `${index + 1}순위 시간을 선택하세요`
                          : `${index + 1}순위 · ${String(selectedHours[index]).padStart(2, "0")}:00`}
                      </p>
                    ))}
                  </div>
                </div>
                <p className="rounded-lg bg-white p-3 text-xs leading-5 text-muted-foreground">
                  선택한 세 시간 중 중개사가 가능한 일정을 확인해 최종 시간을
                  확정합니다.
                </p>
              </div>
              <Button
                className="mt-auto w-full"
                disabled={selectedHours.length !== REQUIRED_TIME_COUNT}
                onClick={confirmReservation}
              >
                <Check />
                예약 요청하기
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

export default BookingPage;
