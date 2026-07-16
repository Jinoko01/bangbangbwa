import { useRef, useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  CalendarCheck,
  Check,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  FileText,
  Image as ImageIcon,
  MapPin,
  Play,
  ShieldCheck,
  Video,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import HeroSearch from "@/components/HeroSearch";
import { PROPERTIES } from "@/data/properties";
import { cn } from "@/lib/utils";

const FLOW_STEPS = [
  [CalendarCheck, "예약", "원하는 매물의 화상 투어 일정을 잡아요"],
  [Video, "라이브 투어", "중개사와 실시간 영상으로 매물을 확인해요"],
  [ClipboardCheck, "체크리스트", "점검 항목을 하나씩 확인하며 기록해요"],
  [FileText, "리포트", "캡처와 요약이 담긴 리포트를 받아요"],
] as const;

const DESKTOP_QUERY = "(min-width: 1024px)";

function subscribeToDesktopQuery(onChange: () => void) {
  const media = window.matchMedia(DESKTOP_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

// lg 이상에서만 스크롤텔링을 켜기 위한 뷰포트 구독
function useIsDesktop() {
  return useSyncExternalStore(
    subscribeToDesktopQuery,
    () => window.matchMedia(DESKTOP_QUERY).matches,
  );
}

function subscribeToWindowScroll(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true });
  window.addEventListener("resize", onChange);
  return () => {
    window.removeEventListener("scroll", onChange);
    window.removeEventListener("resize", onChange);
  };
}

function getActiveStep(runway: HTMLElement | null) {
  if (!runway) {
    return 0;
  }
  const range = runway.offsetHeight - window.innerHeight;
  if (range <= 0) {
    return 0;
  }
  const progress = Math.min(
    1,
    Math.max(0, -runway.getBoundingClientRect().top / range),
  );
  return Math.min(
    FLOW_STEPS.length - 1,
    Math.floor(progress * FLOW_STEPS.length),
  );
}

type FlowStepState = "static" | "done" | "active" | "todo";

function getStepState(index: number, activeStep: number): FlowStepState {
  if (index < activeStep) {
    return "done";
  }
  return index === activeStep ? "active" : "todo";
}

interface FlowStepProps {
  icon: LucideIcon;
  title: string;
  description: string;
  index: number;
  isLast: boolean;
  state: FlowStepState;
}

// 이용 흐름의 한 단계 — 활성이면 확대 + 번호 글로우, 완료면 체크로 전환
function FlowStep({
  icon: Icon,
  title,
  description,
  index,
  isLast,
  state,
}: FlowStepProps) {
  const isActive = state === "active";
  const isDone = state === "done";
  const isTodo = state === "todo";

  return (
    <motion.li
      className="flex origin-left gap-4"
      animate={{ scale: isActive ? 1.04 : 1, opacity: isTodo ? 0.4 : 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
    >
      <div className="flex flex-col items-center">
        <motion.span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold",
            isTodo
              ? "bg-muted text-muted-foreground"
              : "bg-primary text-primary-foreground",
          )}
          animate={
            isActive
              ? {
                  boxShadow: [
                    "0 0 0 0 rgba(22,93,252,0.45)",
                    "0 0 0 12px rgba(22,93,252,0)",
                  ],
                }
              : { boxShadow: "0 0 0 0 rgba(22,93,252,0)" }
          }
          transition={
            isActive
              ? { duration: 1.4, repeat: Infinity, ease: "easeOut" }
              : { duration: 0.2 }
          }
        >
          {isDone ? <Check className="size-4" /> : index + 1}
        </motion.span>
        {!isLast && (
          <span className="relative w-0.5 flex-1 overflow-hidden bg-border">
            <motion.span
              className="absolute inset-0 origin-top bg-primary"
              animate={{ scaleY: isDone ? 1 : 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            />
          </span>
        )}
      </div>
      <div className={isLast ? "" : "pb-7"}>
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-primary" />
          <h3 className={cn("font-semibold", isActive && "text-primary")}>
            {title}
          </h3>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </motion.li>
  );
}

// 스크롤 진행에 따라 단계가 순차 하이라이트되는 이용 흐름 섹션 (lg 이상 sticky 스크롤텔링)
function FlowSection() {
  const runwayRef = useRef<HTMLElement>(null);
  const isDesktop = useIsDesktop();
  const reducedMotion = useReducedMotion();
  const animated = isDesktop && !reducedMotion;
  const activeStep = useSyncExternalStore(subscribeToWindowScroll, () =>
    getActiveStep(runwayRef.current),
  );

  return (
    <section
      id="how"
      ref={runwayRef}
      className="border-y bg-muted/40 lg:h-[400vh]"
    >
      <div className="lg:sticky lg:top-14 lg:flex lg:h-[calc(100svh-3.5rem)] lg:items-center">
        <div className="mx-auto w-full max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-0">
          <div className="mb-14">
            <p className="text-sm font-bold tracking-wider text-primary">
              이용 흐름
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              네 단계면 충분해요
            </h2>
          </div>

          <div className="grid gap-16 lg:grid-cols-[1fr_420px] lg:items-start">
            <ol>
              {FLOW_STEPS.map(([Icon, title, description], index) => (
                <FlowStep
                  key={title}
                  icon={Icon}
                  title={title}
                  description={description}
                  index={index}
                  isLast={index === FLOW_STEPS.length - 1}
                  state={animated ? getStepState(index, activeStep) : "static"}
                />
              ))}
            </ol>

            <div className="rounded-2xl border bg-card p-6 shadow-[0_16px_40px_-8px_rgba(22,93,252,0.15)]">
              <div className="flex items-center justify-between gap-3">
                <strong className="text-[15px] font-semibold">
                  AI 검수 리포트 — 역삼 래미안
                </strong>
                <Badge variant="secondary">자동 생성</Badge>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="grid h-[72px] place-items-center rounded-md bg-muted"
                  >
                    <ImageIcon className="size-[18px] text-muted-foreground" />
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-2">
                <div className="h-2.5 rounded-full bg-muted" />
                <div className="h-2.5 rounded-full bg-muted" />
                <div className="h-2.5 w-3/5 rounded-full bg-muted" />
              </div>
              <div className="mt-4 flex items-center gap-2">
                <CheckCircle2 className="size-4 text-primary" />
                <span className="text-sm font-medium">
                  하자 2건 · 확인 요청 5건 기록됨
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function LandingPage() {
  return (
    <main className="overflow-x-clip bg-background">
      <section className="px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <div className="relative mx-auto min-h-[640px] max-w-[1400px] overflow-hidden rounded-[2rem] bg-slate-950 shadow-2xl shadow-[#165dfc]/15 lg:min-h-[720px]">
          <video
            src="/hero-tour.mp4"
            poster="/hero-poster.webp"
            autoPlay
            muted
            loop
            playsInline
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover opacity-90"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,23,.98)_0%,rgba(2,6,23,.86)_45%,rgba(2,6,23,.25)_100%)]" />

          <div className="relative z-10 grid min-h-[640px] items-center gap-12 p-7 sm:p-12 lg:min-h-[720px] lg:grid-cols-[1.15fr_.85fr] lg:p-20">
            <div className="max-w-2xl text-white">
              <p className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-blue-300 backdrop-blur">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-400 opacity-70" />
                  <span className="relative inline-flex size-2 rounded-full bg-blue-400" />
                </span>
                세입자와 중개사를 잇는 1:1 라이브 투어
              </p>
              <h1 className="text-4xl leading-[1.12] font-bold tracking-[-0.04em] sm:text-5xl lg:text-7xl">
                가보지 않고,
                <br />
                방에서 끝내는
                <br />
                <span className="text-blue-400">실시간 임장</span>
              </h1>
              <p className="mt-7 max-w-xl text-base leading-relaxed text-slate-300 sm:text-xl">
                중개사가 현장에서 비춰주는 화면을 보며 체크리스트로 꼼꼼하게
                비교하고 결정하세요.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Button
                  size="lg"
                  className="h-13 rounded-full px-7 text-base"
                  asChild
                >
                  <Link to="/properties">
                    <MapPin /> 매물 둘러보기 <ArrowRight />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-13 rounded-full border-white/20 bg-white/10 px-7 text-base text-white hover:bg-white/20 hover:text-white"
                  asChild
                >
                  <a href="#how">이용 방법 알아보기</a>
                </Button>
              </div>
            </div>

            <div className="mx-auto w-full max-w-md space-y-4">
              <HeroSearch />
              <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-2 backdrop-blur-xl">
                <div className="rounded-[1.1rem] bg-slate-900/95 p-6 text-white">
                  <div className="flex items-center justify-between">
                    <span className="rounded-md bg-blue-400 px-2 py-1 text-xs font-bold text-blue-950">
                      예약 확정
                    </span>
                    <span className="font-mono text-xs text-slate-400">
                      TODAY 14:00
                    </span>
                  </div>
                  <p className="mt-5 text-lg leading-snug font-semibold">
                    서초구 래미안 투룸
                    <br />
                    화상 투어
                  </p>
                  <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4">
                    <span className="text-xs text-slate-400">
                      SESSION · BBV-9421
                    </span>
                    <span className="flex items-center gap-1 text-sm font-semibold text-blue-300">
                      입장 대기실 <ArrowRight className="size-4" />
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2 text-xs text-slate-300">
                {["#역세권투룸", "#신축오피스텔", "#전세자금대출"].map(
                  (tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-white/10 bg-slate-900/60 px-3 py-1.5"
                    >
                      {tag}
                    </span>
                  ),
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold tracking-wider text-primary">
            핵심 기능
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            집 보는 방식이 달라집니다
          </h2>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-[1fr_368px]">
          <article className="flex flex-col items-center gap-6 rounded-xl border bg-card p-7 shadow-sm sm:flex-row">
            <div className="flex-1">
              <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <Video className="size-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">실시간 라이브 투어</h3>
              <p className="mt-1.5 leading-relaxed text-muted-foreground">
                중개사가 현장에서 직접 비추는 실시간 영상. 보고 싶은 곳을 바로
                요청하세요
              </p>
            </div>
            <div className="relative h-[170px] w-full shrink-0 overflow-hidden rounded-lg bg-slate-900 sm:w-[260px]">
              <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-1 text-[11px] font-semibold text-white">
                <span className="size-1.5 rounded-full bg-white" />
                LIVE
              </span>
              <span className="absolute top-1/2 left-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/20 backdrop-blur">
                <Play className="size-4 fill-current text-white" />
              </span>
              <p className="absolute bottom-3 left-3 text-xs text-white/80">
                강남구 역삼동 · 시청 3명
              </p>
            </div>
          </article>

          <div className="grid gap-4">
            <article className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="size-[18px] text-primary" />
                <h3 className="font-semibold">스마트 체크리스트</h3>
              </div>
              <div className="mt-3 space-y-2 text-sm">
                <p className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-primary" />
                  곰팡이·누수 흔적 확인
                </p>
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Circle className="size-3.5" />
                  수압·배수 상태 확인
                </p>
              </div>
            </article>

            <article className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <FileText className="size-[18px] text-primary" />
                <h3 className="font-semibold">AI 검수 리포트</h3>
              </div>
              <div className="mt-3 flex gap-1.5">
                <Badge variant="secondary">캡처 12장</Badge>
                <Badge variant="secondary">하자 2건</Badge>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                통화가 끝나면 캡처·요약·하자 기록이 자동으로
              </p>
            </article>
          </div>
        </div>
      </section>

      <FlowSection />

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-16 text-center text-primary-foreground sm:px-12">
          <ShieldCheck className="mx-auto size-10" />
          <h2 className="mt-5 text-3xl font-bold tracking-tight">
            오늘 올라온 매물 {PROPERTIES.length}건,
            <br className="sm:hidden" /> 방송으로 확인하세요
          </h2>
          <p className="mt-4 text-primary-foreground/75">
            시간과 거리에 상관없이, 더 확실하게 보고 결정하세요.
          </p>
          <Button
            size="lg"
            variant="secondary"
            className="mt-8 rounded-full px-7"
            asChild
          >
            <Link to="/properties">
              매물 둘러보기 <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p className="flex items-center gap-2 font-semibold text-foreground">
            <img
              src="/logo-symbol.png"
              alt=""
              className="size-7 rounded-md bg-white"
            />
            방방봐
          </p>
          <p>© 2026 BANGBANGBWA. All rights reserved.</p>
          <p className="flex items-center gap-2">
            <Check className="size-4 text-primary" /> 방을 방송으로 봐
          </p>
        </div>
      </footer>
    </main>
  );
}

export default LandingPage;
