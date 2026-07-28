import {
  Fragment,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  CalendarCheck,
  Check,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Eye,
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
const FLOW_STEP_HOP_MS = 300;

function subscribeToDesktopQuery(onChange: () => void) {
  const media = window.matchMedia(DESKTOP_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

// 활성 단계 산출 방식(러너웨이 진행률/리스트 위치)을 가르기 위한 뷰포트 구독
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

function getRunwayStep(runway: HTMLElement | null, stepCount: number) {
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
  return Math.min(stepCount - 1, Math.floor(progress * stepCount));
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

// 스크롤 진행에 따라 단계가 순차 하이라이트되는 이용 흐름 섹션
// (lg 이상은 sticky 스크롤텔링, 미만은 단계 버튼 탭 전환)
function FlowSection() {
  const runwayRef = useRef<HTMLElement>(null);
  const isDesktop = useIsDesktop();
  const reducedMotion = useReducedMotion();
  const animated = isDesktop && !reducedMotion;
  const [mobileStep, setMobileStep] = useState(0);
  const [targetStep, setTargetStep] = useState(0);
  const [stepDirection, setStepDirection] = useState(1);
  const [hopMs, setHopMs] = useState(FLOW_STEP_HOP_MS);
  const activeStep = useSyncExternalStore(subscribeToWindowScroll, () =>
    isDesktop ? getRunwayStep(runwayRef.current, FLOW_STEPS.length) : 0,
  );
  const [ActiveIcon, activeTitle, activeDescription] = FLOW_STEPS[targetStep];

  const selectMobileStep = (index: number) => {
    setStepDirection(index >= targetStep ? 1 : -1);
    setTargetStep(index);
    if (reducedMotion) {
      setMobileStep(index);
      return;
    }
    const distance = Math.abs(index - mobileStep);
    if (distance > 0) {
      setHopMs(Math.round(FLOW_STEP_HOP_MS / distance));
      setMobileStep(mobileStep + Math.sign(index - mobileStep));
    }
  };

  // 단계를 건너뛰어 선택해도 스텝퍼는 목표까지 한 칸씩 순차로 이동한다.
  // 홉 간격은 이동 거리로 나눠, 거리와 무관하게 총 소요 시간을 일정하게 유지한다
  useEffect(() => {
    if (mobileStep === targetStep) {
      return;
    }
    const timer = setTimeout(() => {
      setMobileStep((step) => step + Math.sign(targetStep - step));
    }, hopMs);
    return () => clearTimeout(timer);
  }, [mobileStep, targetStep, hopMs]);

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
            <ol className="hidden lg:block">
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

            <div className="lg:hidden">
              <div className="flex items-start">
                {FLOW_STEPS.map(([, title], index) => {
                  const isSelected = index === mobileStep;
                  const isReached = index <= mobileStep;
                  return (
                    <Fragment key={title}>
                      {index > 0 && (
                        <span className="relative mt-[17px] h-0.5 min-w-4 flex-1 overflow-hidden rounded-full bg-border">
                          <motion.span
                            className="absolute inset-0 origin-left bg-primary"
                            animate={{ scaleX: isReached ? 1 : 0 }}
                            transition={{
                              duration: hopMs / 1000,
                              ease: "easeOut",
                            }}
                          />
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => selectMobileStep(index)}
                        aria-current={index === targetStep ? "step" : undefined}
                        className="flex w-16 flex-col items-center gap-1.5"
                      >
                        <motion.span
                          className={cn(
                            "grid size-9 place-items-center rounded-full text-sm font-bold",
                            isReached
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground",
                          )}
                          animate={
                            isSelected && !reducedMotion
                              ? {
                                  scale: 1.08,
                                  boxShadow: [
                                    "0 0 0 0 rgba(22,93,252,0.45)",
                                    "0 0 0 10px rgba(22,93,252,0)",
                                  ],
                                }
                              : {
                                  scale: 1,
                                  boxShadow: "0 0 0 0 rgba(22,93,252,0)",
                                }
                          }
                          transition={{
                            scale: {
                              type: "spring",
                              stiffness: 260,
                              damping: 24,
                            },
                            boxShadow:
                              isSelected && !reducedMotion
                                ? {
                                    duration: 1.4,
                                    repeat: Infinity,
                                    ease: "easeOut",
                                  }
                                : { duration: 0.2 },
                          }}
                        >
                          {index < mobileStep ? (
                            <Check className="size-4" />
                          ) : (
                            index + 1
                          )}
                        </motion.span>
                        <span
                          className={cn(
                            "text-xs font-medium break-keep",
                            isSelected
                              ? "text-primary"
                              : "text-muted-foreground",
                          )}
                        >
                          {title}
                        </span>
                      </button>
                    </Fragment>
                  );
                })}
              </div>

              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={targetStep}
                  initial={
                    reducedMotion
                      ? false
                      : { opacity: 0, x: 24 * stepDirection }
                  }
                  animate={{ opacity: 1, x: 0 }}
                  exit={
                    reducedMotion ? {} : { opacity: 0, x: -24 * stepDirection }
                  }
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="mt-6 rounded-xl border bg-card p-5 shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <ActiveIcon className="size-5 text-primary" />
                    <h3 className="font-semibold">{activeTitle}</h3>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {activeDescription}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

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

const FEATURES = [
  {
    icon: Video,
    label: "라이브 투어",
    title: "실시간 라이브 투어",
    description:
      "중개사가 현장에서 직접 비추는 실시간 영상. 보고 싶은 곳을 바로 요청하세요",
  },
  {
    icon: ClipboardCheck,
    label: "체크리스트",
    title: "스마트 체크리스트",
    description:
      "곰팡이·누수·수압까지, 점검 항목을 하나씩 확인하며 놓치지 않고 기록해요",
  },
  {
    icon: FileText,
    label: "AI 리포트",
    title: "AI 검수 리포트",
    description: "통화가 끝나면 캡처와 요약, 하자 기록이 자동으로 정리돼요",
  },
] as const;

const FEATURE_CHECKLIST = [
  { label: "곰팡이·누수 흔적 확인", done: true },
  { label: "수압 확인", done: true },
  { label: "채광 확인", done: false },
] as const;

const FEATURE_TINTED_SHADOW = "shadow-[0_16px_40px_-8px_rgba(22,93,252,0.15)]";

// 기능별 목업 패널 — 같은 포스터를 라이브 화면 / 확대 크롭 + 체크리스트 /
// 블러 + 리포트 요약으로 다르게 연출한다 (전용 에셋 확보 시 src만 교체)
function FeatureVisual({ index }: { index: number }) {
  const reducedMotion = useReducedMotion();

  if (index === 0) {
    return (
      <>
        <img
          src="/hero-poster.webp"
          alt="중개사가 라이브 투어로 비추는 매물 내부 화면"
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,.15)_0%,rgba(2,6,23,.35)_60%,rgba(2,6,23,.75)_100%)]" />
        <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2 py-1 text-[11px] font-semibold text-white">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-white" />
          </span>
          LIVE
        </span>
        <span className="absolute top-1/2 left-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/20 backdrop-blur">
          <Play className="size-4 fill-current text-white" />
        </span>
        <p className="absolute bottom-3 left-3 text-xs font-medium text-white/90">
          강남구 역삼동
        </p>
        <p className="absolute right-3 bottom-3 flex items-center gap-1 text-xs text-white/80">
          <Eye className="size-3.5" />
          시청 중
        </p>
      </>
    );
  }

  if (index === 1) {
    return (
      <>
        <img
          src="/hero-poster.webp"
          alt="점검 중인 매물 내부 화면"
          loading="lazy"
          className="absolute inset-0 h-full w-full scale-125 object-cover object-[70%_60%]"
        />
        <div className="absolute inset-0 bg-slate-950/55" />
        <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-lg border border-white/15 bg-slate-950/60 p-4 backdrop-blur-md sm:inset-x-6">
          <div className="flex items-center gap-2 text-white">
            <ClipboardCheck className="size-4 text-blue-400" />
            <strong className="text-sm font-semibold">투어 중 점검 항목</strong>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {FEATURE_CHECKLIST.map(({ label, done }, itemIndex) => (
              <motion.li
                key={label}
                className={cn(
                  "flex items-center gap-2",
                  done ? "text-white/90" : "text-white/55",
                )}
                initial={reducedMotion ? false : { opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  delay: 0.2 + itemIndex * 0.15,
                  duration: 0.25,
                  ease: "easeOut",
                }}
              >
                {done ? (
                  <CheckCircle2 className="size-3.5 shrink-0 text-blue-400" />
                ) : (
                  <Circle className="size-3.5 shrink-0 text-white/40" />
                )}
                {label}
              </motion.li>
            ))}
          </ul>
        </div>
      </>
    );
  }

  return (
    <>
      <img
        src="/hero-poster.webp"
        alt="투어를 마친 매물 내부 화면"
        loading="lazy"
        className="absolute inset-0 h-full w-full scale-110 object-cover blur-sm"
      />
      <div className="absolute inset-0 bg-slate-950/60" />
      <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-lg border border-white/15 bg-slate-950/60 p-4 backdrop-blur-md sm:inset-x-6">
        <div className="flex items-center justify-between gap-2 text-white">
          <span className="flex items-center gap-2">
            <FileText className="size-4 text-blue-400" />
            <strong className="text-sm font-semibold">AI 검수 리포트</strong>
          </span>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/80">
            자동 생성
          </span>
        </div>
        <div className="mt-3 flex gap-1.5">
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white/90">
            캡처 12장
          </span>
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white/90">
            하자 2건
          </span>
        </div>
        <div className="mt-3 space-y-1.5">
          <div className="h-2 rounded-full bg-white/15" />
          <div className="h-2 w-3/5 rounded-full bg-white/15" />
        </div>
      </div>
    </>
  );
}

// 핵심 기능 쇼케이스 — 활성 기능이 메인 카드로 크게 표시된다
// (lg 이상은 커서 hover/focus, 미만은 카드 클릭으로 전환)
function FeaturesSection() {
  const reducedMotion = useReducedMotion();
  const [selected, setSelected] = useState(0);
  const active = selected;
  const { icon: ActiveIcon, title, description } = FEATURES[active];

  const selectFeature = (index: number) => {
    setSelected(index);
  };

  return (
    <section>
      <div>
        <div className="mx-auto w-full max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold tracking-wider text-primary">
              핵심 기능
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              집 보는 방식이 달라집니다
            </h2>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-[1fr_368px]">
            <div className="grid grid-cols-3 gap-2 lg:hidden">
              {FEATURES.map(({ icon: Icon, label }, index) => (
                <button
                  type="button"
                  key={label}
                  onClick={() => selectFeature(index)}
                  aria-current={active === index ? "true" : undefined}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl border bg-card p-3 transition-colors duration-300",
                    active === index && "border-primary/60 bg-primary/5",
                  )}
                >
                  <Icon
                    className={cn(
                      "size-5",
                      active === index
                        ? "text-primary"
                        : "text-muted-foreground",
                    )}
                  />
                  <span
                    className={cn(
                      "text-xs font-medium break-keep",
                      active === index
                        ? "text-primary"
                        : "text-muted-foreground",
                    )}
                  >
                    {label}
                  </span>
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait" initial={false}>
              <motion.article
                key={active}
                initial={
                  reducedMotion ? false : { opacity: 0, x: -12, scale: 0.985 }
                }
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={reducedMotion ? {} : { opacity: 0, x: 12, scale: 0.985 }}
                transition={{
                  duration: reducedMotion ? 0 : 0.32,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className={cn(
                  "relative isolate flex flex-col gap-6 overflow-hidden rounded-2xl border bg-card p-7 sm:flex-row sm:items-center",
                  FEATURE_TINTED_SHADOW,
                )}
              >
                {!reducedMotion && (
                  <motion.div
                    aria-hidden="true"
                    className="pointer-events-none absolute -top-24 h-56 w-56 rounded-full bg-primary/10 blur-3xl"
                    initial={{ left: "-20%", opacity: 0 }}
                    animate={{ left: "72%", opacity: [0, 0.9, 0.35] }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                )}
                <div className="relative z-10 flex-1">
                  <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                    <ActiveIcon className="size-5" />
                  </div>
                  <h3 className="mt-4 text-xl font-semibold">{title}</h3>
                  <p className="mt-2 leading-relaxed break-keep text-muted-foreground">
                    {description}
                  </p>
                </div>
                <motion.div
                  className="relative z-10 h-[220px] w-full shrink-0 overflow-hidden rounded-xl bg-slate-900 sm:h-[260px] sm:w-[300px] lg:w-[380px]"
                  initial={reducedMotion ? false : { scale: 0.96 }}
                  animate={{ scale: 1 }}
                  transition={{
                    duration: reducedMotion ? 0 : 0.45,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <FeatureVisual index={active} />
                </motion.div>
              </motion.article>
            </AnimatePresence>

            <div className="hidden gap-4 lg:grid lg:grid-rows-3">
              {FEATURES.map(
                (
                  {
                    icon: Icon,
                    title: itemTitle,
                    description: itemDescription,
                  },
                  index,
                ) => {
                  const isActive = active === index;
                  return (
                    <motion.button
                      type="button"
                      key={itemTitle}
                      onClick={() => selectFeature(index)}
                      onPointerEnter={() => selectFeature(index)}
                      onFocus={() => selectFeature(index)}
                      aria-current={isActive ? "true" : undefined}
                      animate={{
                        x: isActive && !reducedMotion ? -6 : 0,
                        scale: isActive && !reducedMotion ? 1.015 : 1,
                      }}
                      whileHover={reducedMotion ? undefined : { x: -4 }}
                      whileTap={reducedMotion ? undefined : { scale: 0.985 }}
                      transition={{
                        type: "spring",
                        stiffness: 320,
                        damping: 26,
                      }}
                      className={cn(
                        "relative overflow-hidden rounded-xl border bg-card p-5 text-left transition-[border-color,box-shadow,background-color] duration-300",
                        isActive
                          ? cn(
                              "border-primary/50 bg-primary/[0.025]",
                              FEATURE_TINTED_SHADOW,
                            )
                          : "shadow-sm hover:shadow-[0_16px_40px_-8px_rgba(22,93,252,0.15)]",
                      )}
                    >
                      <motion.span
                        aria-hidden="true"
                        className="absolute inset-y-0 left-0 w-1 rounded-r-full bg-primary"
                        animate={{
                          scaleY: isActive ? 1 : 0,
                          opacity: isActive ? 1 : 0,
                        }}
                        transition={{ duration: 0.22, ease: "easeOut" }}
                      />
                      <span className="flex items-center gap-2.5">
                        <span
                          className={cn(
                            "grid size-8 shrink-0 place-items-center rounded-lg transition-colors duration-300",
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : "bg-primary/10 text-primary",
                          )}
                        >
                          <Icon className="size-4" />
                        </span>
                        <span
                          className={cn(
                            "font-semibold",
                            isActive && "text-primary",
                          )}
                        >
                          {itemTitle}
                        </span>
                      </span>
                      <span className="mt-2 block text-sm leading-relaxed break-keep text-muted-foreground">
                        {itemDescription}
                      </span>
                    </motion.button>
                  );
                },
              )}
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
      <section className="lg:px-8 lg:py-10">
        <div className="relative mx-auto max-w-[1400px] overflow-hidden bg-slate-950 lg:min-h-[720px] lg:rounded-[2rem] lg:shadow-2xl lg:shadow-[#165dfc]/15">
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
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,.95)_0%,rgba(2,6,23,.8)_40%,rgba(2,6,23,.45)_80%,rgba(2,6,23,.3)_100%)] lg:bg-[linear-gradient(90deg,rgba(2,6,23,.98)_0%,rgba(2,6,23,.86)_45%,rgba(2,6,23,.25)_100%)]" />

          <div className="relative z-10 grid items-center gap-8 px-6 py-10 sm:p-12 lg:min-h-[720px] lg:grid-cols-[1.15fr_.85fr] lg:gap-12 lg:p-20">
            <div className="max-w-2xl text-white">
              <p className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-blue-300 backdrop-blur">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-400 opacity-70" />
                  <span className="relative inline-flex size-2 rounded-full bg-blue-400" />
                </span>
                세입자와 중개사를 잇는 1:1 라이브 투어
              </p>
              <h1 className="text-4xl leading-[1.12] font-bold tracking-[-0.04em] sm:text-5xl lg:text-7xl">
                방송으로 방을 봐
                <br />
                <span className="text-blue-400">방방봐</span>
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
              <div className="hidden flex-wrap justify-end gap-2 text-xs text-slate-300 lg:flex">
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

      <FeaturesSection />

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
