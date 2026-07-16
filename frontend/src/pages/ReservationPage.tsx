import { CalendarClock, Video } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// API 연동 전 목데이터 — 예약 slug가 RTC 세션 room 식별자가 된다.
const RESERVATIONS = [
  {
    slug: "resv-101",
    title: "관악구 신림동 · 밝은빌 302호",
    agent: "김중개 (행복공인중개사)",
    scheduledAt: "2026-07-16 15:00",
    status: "확정" as const,
  },
  {
    slug: "resv-102",
    title: "동작구 상도동 · 상도스카이 1204호",
    agent: "박중개 (미래부동산)",
    scheduledAt: "2026-07-17 11:00",
    status: "대기" as const,
  },
];

// PAGE-09 예약 목록 — RES-08 예약 목록 조회, PAGE-10의 RTC 입장 진입점
function ReservationPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-svh bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-semibold text-foreground">예약 목록</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          확정된 예약은 라이브 세션에 입장할 수 있어요.
        </p>

        <div className="mt-6 flex flex-col gap-4">
          {RESERVATIONS.map((reservation) => (
            <Card key={reservation.slug} className="gap-4 py-5">
              <CardHeader className="px-5">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      reservation.status === "확정" ? "default" : "secondary"
                    }
                  >
                    {reservation.status}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {reservation.agent}
                  </span>
                </div>
                <CardTitle className="mt-1 text-lg font-semibold">
                  {reservation.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between px-5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarClock className="size-4" />
                  {reservation.scheduledAt}
                </div>
                <Button
                  disabled={reservation.status !== "확정"}
                  onClick={() => navigate(`/reservation/${reservation.slug}`)}
                >
                  <Video />
                  라이브 입장
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ReservationPage;
