import {
  type ReactNode,
  type RefObject,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Camera,
  CameraOff,
  ChevronUp,
  ListChecks,
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  RotateCcw,
  Trash2,
  Users,
  Video,
  VideoOff,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import ReservationChecklist from "@/components/ReservationChecklist";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useChecklist } from "@/hooks/queries/checklistQueries";
import { useMeetingDetail } from "@/hooks/queries/meetingQueries";
import { usePropertyDetail } from "@/hooks/queries/propertyQueries";
import {
  type SessionCapture,
  useSessionCaptures,
} from "@/hooks/useSessionCaptures";
import { useVideoAspect } from "@/hooks/useVideoAspect";
import { formatMeetingDateTime, getMeetingDateTime } from "@/lib/meeting";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import type { UserRole } from "@/types";

type SessionStatus =
  "connecting" | "waiting" | "connected" | "peer-left" | "room-full" | "error";

const STATUS_LABEL: Record<SessionStatus, string> = {
  connecting: "연결 준비 중",
  waiting: "상대방 대기 중",
  connected: "연결됨",
  "peer-left": "상대방이 나갔어요",
  "room-full": "이미 두 명이 입장한 세션이에요",
  error: "연결에 실패했어요",
};

const STATUS_BADGE_VARIANT: Record<
  SessionStatus,
  "default" | "secondary" | "destructive"
> = {
  connecting: "secondary",
  waiting: "secondary",
  connected: "default",
  "peer-left": "secondary",
  "room-full": "destructive",
  error: "destructive",
};

type MediaStatus = "pending" | "ready" | "blocked";

// 관리자는 라이브 미팅에 참여하지 않지만 타입 완결성을 위해 세입자 상대로 둔다
const PEER_ROLE: Record<UserRole, UserRole> = {
  세입자: "중개사",
  중개사: "세입자",
  관리자: "세입자",
};

interface SignalMessage {
  type:
    | "joined"
    | "peer-joined"
    | "peer-left"
    | "room-full"
    | "description"
    | "candidate";
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit | null;
}

function formatCaptureTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// 영상 타일 — 영상이 없을 때는 notice로 상황을 대신 알린다
interface VideoTileProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  label: string;
  className: string;
  muted?: boolean;
  aspect?: number | null;
  notice?: ReactNode;
}

function VideoTile({
  videoRef,
  label,
  className,
  muted = false,
  aspect,
  notice,
}: VideoTileProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg bg-slate-900",
        className,
      )}
      // 타일이 스트림 비율을 그대로 따라가 검은 여백이 생기지 않게 한다
      style={aspect ? { aspectRatio: aspect } : undefined}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className="size-full object-contain"
      />
      {notice}
      <span className="absolute bottom-2 left-2 max-w-[calc(100%-1rem)] truncate rounded-md bg-slate-950/70 px-2 py-0.5 text-xs font-medium text-white">
        {label}
      </span>
    </div>
  );
}

// 영상 대신 상태를 안내하는 타일 오버레이 — compact는 우측 상단 내 화면용
interface TileNoticeProps {
  icon: ReactNode;
  compact?: boolean;
  children: ReactNode;
}

function TileNotice({ icon, compact = false, children }: TileNoticeProps) {
  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900 px-4 text-center text-sm text-slate-400",
        compact && "gap-1 px-2 pb-5 text-xs",
      )}
    >
      {icon}
      <span className="max-w-80">{children}</span>
    </div>
  );
}

// 내 영상이 보이지 않는 이유를 상황별로 안내한다
function LocalTileNotice({
  mediaStatus,
  camOn,
}: {
  mediaStatus: MediaStatus;
  camOn: boolean;
}) {
  if (mediaStatus === "blocked") {
    return (
      <TileNotice icon={<CameraOff className="size-4" />} compact>
        카메라 권한 필요
      </TileNotice>
    );
  }

  if (mediaStatus === "pending") {
    return (
      <TileNotice icon={<Loader2 className="size-4 animate-spin" />} compact>
        준비 중
      </TileNotice>
    );
  }

  if (!camOn) {
    return (
      <TileNotice icon={<VideoOff className="size-4" />} compact>
        카메라 꺼짐
      </TileNotice>
    );
  }

  return null;
}

// 스스로 풀리지 않아 사용자가 손을 써야 하는 상태
const RECOVERABLE_STATUS: Record<SessionStatus, boolean> = {
  connecting: false,
  waiting: false,
  connected: false,
  "peer-left": true,
  "room-full": true,
  error: true,
};

const RETRY_LABEL: Partial<Record<SessionStatus, string>> = {
  "peer-left": "다시 연결",
  "room-full": "다시 입장",
  error: "다시 시도",
};

// 상대 영상이 오기 전까지 그 자리에서 준비 상태를 알린다.
// 손을 써야 하는 상태는 좁은 타일 대신 스테이지 전체가 맡는다
function PeerPreparingNotice({
  status,
  compact,
}: {
  status: SessionStatus;
  compact?: boolean;
}) {
  if (status === "connected" || RECOVERABLE_STATUS[status]) {
    return null;
  }

  return (
    <TileNotice
      icon={
        <Loader2
          className={cn("animate-spin", compact ? "size-4" : "size-6")}
        />
      }
      compact={compact}
    >
      {STATUS_LABEL[status]}
    </TileNotice>
  );
}

// 세션이 막히면 영상 위 작은 문구가 아니라 스테이지를 덮고 다음 행동을 제시한다.
// 나가기는 컨트롤 바에 항상 있으므로 여기서는 복구 하나만 제안한다
function StageRecoveryOverlay({
  status,
  onRetry,
}: {
  status: SessionStatus;
  onRetry: () => void;
}) {
  if (!RECOVERABLE_STATUS[status]) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-950/90 px-6 text-center">
      <VideoOff className="size-8 text-slate-500" />
      <p className="text-sm text-slate-300">{STATUS_LABEL[status]}</p>
      <Button size="sm" onClick={onRetry}>
        <RotateCcw /> {RETRY_LABEL[status]}
      </Button>
    </div>
  );
}

// 마이크·카메라처럼 켜고 끄는 통화 옵션 버튼
interface ControlButtonProps {
  on: boolean;
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}

function ControlButton({
  on,
  label,
  disabled,
  onClick,
  children,
}: ControlButtonProps) {
  return (
    <Button
      type="button"
      size="icon-lg"
      aria-label={label}
      aria-pressed={on}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-full border border-slate-700 bg-slate-800 text-white hover:bg-slate-700",
        // 꺼짐은 위험이 아니라 비활성 — 빨강은 통화 종료에만 쓴다
        !on && "border-slate-800 bg-slate-800/50 text-slate-500",
      )}
    >
      {children}
    </Button>
  );
}

// 세입자 전용 패널 — 데스크톱 사이드바와 모바일 하단 시트가 함께 쓴다.
// 명세 "사용자 권한" — 체크리스트 확인·수정은 세입자만 가능하다
interface ChecklistPanelProps {
  meetingId: number | undefined;
}

function ChecklistPanel({ meetingId }: ChecklistPanelProps) {
  const { data: checklist } = useChecklist(meetingId);
  const items = checklist?.items ?? [];
  const completedCount = items.filter(
    (item) => item.status === "COMPLETED",
  ).length;

  return (
    <section className="flex h-full min-h-0 flex-col">
      <h2 className="mb-2 flex shrink-0 items-center gap-1.5 text-sm font-semibold">
        <ListChecks className="size-4" />
        체크리스트
        <span className="font-normal text-muted-foreground">
          {completedCount}/{items.length}
        </span>
      </h2>
      <ReservationChecklist meetingId={meetingId} variant="bare" />
    </section>
  );
}

// 이번 세션에서 남긴 캡처 — 주 화면 아래에 쌓아 방금 찍은 것이 바로 보이게 한다
interface CaptureStripProps {
  captures: SessionCapture[];
  onSelect: (capture: SessionCapture) => void;
}

function CaptureStrip({ captures, onSelect }: CaptureStripProps) {
  if (captures.length === 0) {
    return null;
  }

  return (
    // w-fit + mx-auto — 가운데 정렬하되 넘칠 때 첫 항목이 잘리지 않게 한다
    <ul className="mx-auto mb-3 flex w-fit max-w-full gap-2 overflow-x-auto pb-1">
      {captures.map((capture) => (
        <li key={capture.id} className="shrink-0">
          <button
            type="button"
            onClick={() => onSelect(capture)}
            className="block overflow-hidden rounded-md border border-slate-700 transition-colors hover:border-primary"
          >
            <img
              src={capture.url}
              alt={`${formatCaptureTime(capture.createdAt)} 캡처`}
              className="h-12 w-20 object-cover"
            />
          </button>
        </li>
      ))}
    </ul>
  );
}

// PAGE-12 RTC 회의 — RTC-02 입장, RTC-03 퇴장. 시그널링은 dev 서버의 /signal 릴레이 사용.
// slug는 회의 id — 시그널링 방 이름과 회의 상세 조회 키를 겸한다
function ReservationLivePage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const [status, setStatus] = useState<SessionStatus>("connecting");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [mediaStatus, setMediaStatus] = useState<MediaStatus>("pending");
  // 값이 바뀔 때마다 연결 effect를 처음부터 다시 실행한다
  const [attempt, setAttempt] = useState(0);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [previewCapture, setPreviewCapture] = useState<SessionCapture | null>(
    null,
  );
  const mediaBlocked = mediaStatus === "blocked";

  const remoteAspect = useVideoAspect(remoteVideoRef);
  const localAspect = useVideoAspect(localVideoRef);

  const leaveSession = () => navigate("/reservations");

  const retryConnection = () => {
    setStatus("connecting");
    setMediaStatus("pending");
    setAttempt((current) => current + 1);
  };

  const meetingId = Number(slug);
  const { data: meeting } = useMeetingDetail(
    Number.isInteger(meetingId) ? meetingId : undefined,
  );
  const { data: property } = usePropertyDetail(
    meeting?.propertyId ?? -1,
    meeting !== undefined,
  );
  const meetingAt = meeting && getMeetingDateTime(meeting);
  const { data: checklistData } = useChecklist(meeting?.meetingId);
  const checklistItems = checklistData?.items ?? [];

  const myLabel = user ? `나 (${user.role})` : "나";
  const peerLabel = user ? PEER_ROLE[user.role] : "상대방";
  const completedCount = checklistItems.filter(
    (item) => item.status === "COMPLETED",
  ).length;

  // 중개사는 현장에서 카메라를 겨누고, 세입자는 그 화면을 보고 판단한다.
  // 각자에게 중요한 영상이 반대라서 큰 타일에 올릴 스트림도 반대가 된다
  const isBroker = user?.role === "중개사";
  const localTile = {
    videoRef: localVideoRef,
    label: isBroker ? "내 카메라 (송출 중)" : myLabel,
    muted: true,
    aspect: localAspect,
    notice: <LocalTileNotice mediaStatus={mediaStatus} camOn={camOn} />,
  };
  const peerTile = {
    videoRef: remoteVideoRef,
    label: peerLabel,
    muted: false,
    aspect: remoteAspect,
    notice: <PeerPreparingNotice status={status} />,
  };
  const primaryTile = isBroker ? localTile : peerTile;
  const secondaryTile = isBroker
    ? { ...peerTile, notice: <PeerPreparingNotice status={status} compact /> }
    : localTile;

  // 중개사에게는 체크리스트가 없어(명세상 불가) 패널 자체를 두지 않고
  // 그만큼 뷰파인더에 내준다
  const showPanel = !isBroker;

  const { captures, capture, removeCapture } = useSessionCaptures(
    primaryTile.videoRef,
  );

  // RTC-05 — 캡처는 영상 프레임이 있어야 가능하므로 실패를 사용자에게 알린다
  const [captureError, captureAction, capturing] = useActionState<
    string | null
  >(async () => {
    const captured = await capture();
    return captured
      ? null
      : "지금은 화면을 캡처할 수 없어요. 영상이 나온 뒤 다시 시도해 주세요.";
  }, null);

  const deletePreviewCapture = () => {
    if (previewCapture) {
      removeCapture(previewCapture.id);
      setPreviewCapture(null);
    }
  };

  useEffect(() => {
    if (!slug) {
      return;
    }

    let disposed = false;
    let pc: RTCPeerConnection | null = null;
    let ws: WebSocket | null = null;
    let localStream: MediaStream | null = null;
    // 원격 description 설정 전에 도착한 ICE 후보 보관
    const pendingCandidates: RTCIceCandidateInit[] = [];

    async function start() {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
      } catch {
        localStream = null;
      }
      if (disposed) {
        localStream?.getTracks().forEach((t) => t.stop());
        return;
      }

      localStreamRef.current = localStream;
      setMediaStatus(localStream ? "ready" : "blocked");
      if (localVideoRef.current && localStream) {
        localVideoRef.current.srcObject = localStream;
      }

      pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      if (localStream) {
        for (const track of localStream.getTracks()) {
          pc.addTrack(track, localStream);
        }
      } else {
        // 장치가 없어도 상대 영상은 수신할 수 있게 recvonly로 입장
        pc.addTransceiver("video", { direction: "recvonly" });
        pc.addTransceiver("audio", { direction: "recvonly" });
      }

      pc.ontrack = ({ streams: [stream] }) => {
        if (remoteVideoRef.current && stream) {
          remoteVideoRef.current.srcObject = stream;
        }
      };

      pc.onconnectionstatechange = () => {
        if (!pc) {
          return;
        }
        if (pc.connectionState === "connected") {
          setStatus("connected");
        }
        if (pc.connectionState === "failed") {
          setStatus("error");
        }
      };

      const protocol = location.protocol === "https:" ? "wss" : "ws";
      ws = new WebSocket(
        `${protocol}://${location.host}/signal?room=${encodeURIComponent(slug!)}`,
      );

      const send = (message: SignalMessage) => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(message));
        }
      };

      pc.onicecandidate = ({ candidate }) => {
        send({ type: "candidate", candidate: candidate?.toJSON() ?? null });
      };

      ws.onopen = () => setStatus("waiting");
      ws.onerror = () => setStatus("error");

      ws.onmessage = async (event) => {
        if (!pc) {
          return;
        }
        const message: SignalMessage = JSON.parse(event.data);

        switch (message.type) {
          case "room-full":
            setStatus("room-full");
            break;
          case "peer-joined":
            await pc.setLocalDescription();
            send({
              type: "description",
              description: pc.localDescription ?? undefined,
            });
            break;
          case "peer-left":
            setStatus("peer-left");
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = null;
            }
            break;
          case "description": {
            if (!message.description) {
              break;
            }
            await pc.setRemoteDescription(message.description);
            if (message.description.type === "offer") {
              await pc.setLocalDescription();
              send({
                type: "description",
                description: pc.localDescription ?? undefined,
              });
            }
            for (const candidate of pendingCandidates.splice(0)) {
              await pc.addIceCandidate(candidate);
            }
            break;
          }
          case "candidate":
            if (message.candidate === null || message.candidate) {
              if (pc.remoteDescription) {
                await pc.addIceCandidate(message.candidate ?? undefined);
              } else if (message.candidate) {
                pendingCandidates.push(message.candidate);
              }
            }
            break;
        }
      };
    }

    void start();

    return () => {
      disposed = true;
      localStream?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      pc?.close();
      ws?.close();
    };
  }, [slug, attempt]);

  const toggleTrack = (kind: "audio" | "video", next: boolean) => {
    const tracks =
      kind === "audio"
        ? localStreamRef.current?.getAudioTracks()
        : localStreamRef.current?.getVideoTracks();
    tracks?.forEach((track) => {
      track.enabled = next;
    });
  };

  const handleToggleMic = () => {
    toggleTrack("audio", !micOn);
    setMicOn(!micOn);
  };

  const handleToggleCam = () => {
    toggleTrack("video", !camOn);
    setCamOn(!camOn);
  };

  return (
    // GNB를 숨기는 화면이라 뷰포트 전체를 쓴다 (App의 hideGlobalNav와 짝)
    <main className="flex h-svh flex-col overflow-hidden bg-slate-50">
      <section className="shrink-0 border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-base font-semibold lg:text-lg">
              {property?.title ?? "라이브 점검"}
            </h1>
            <Badge
              role="status"
              aria-live="polite"
              variant={STATUS_BADGE_VARIANT[status]}
            >
              {STATUS_LABEL[status]}
            </Badge>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {meetingAt && (
              <span className="hidden text-xs text-muted-foreground lg:inline">
                {formatMeetingDateTime(meetingAt)}
              </span>
            )}
            {user && (
              <Badge variant="secondary" className="hidden sm:flex">
                <Users /> {myLabel} · {peerLabel}
              </Badge>
            )}
          </div>
        </div>
      </section>

      <div
        className={cn(
          // grid-rows를 명시하지 않으면 행이 내용 높이로 늘어나 패널이 화면 밖으로 새어나간다
          "relative mx-auto min-h-0 w-full max-w-7xl flex-1 lg:grid lg:grid-rows-[minmax(0,1fr)] lg:gap-4 lg:p-4",
          showPanel ? "lg:grid-cols-[minmax(0,1fr)_370px]" : "lg:grid-cols-1",
        )}
      >
        <section className="absolute inset-0 flex flex-col bg-slate-950 lg:relative lg:inset-auto lg:rounded-xl lg:border">
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden lg:p-3">
            {/* 보조 영상을 주 영상 모서리에 붙이려고 영상 크기만큼만 차지하는 래퍼를 둔다 */}
            <div
              className="relative max-h-full w-full lg:h-full lg:w-auto lg:max-w-full"
              style={{ aspectRatio: primaryTile.aspect ?? 16 / 9 }}
            >
              <VideoTile
                videoRef={primaryTile.videoRef}
                label={primaryTile.label}
                muted={primaryTile.muted}
                className="size-full"
                notice={primaryTile.notice}
              />
              <VideoTile
                videoRef={secondaryTile.videoRef}
                label={secondaryTile.label}
                muted={secondaryTile.muted}
                aspect={secondaryTile.aspect}
                className="absolute top-2 right-2 w-24 border border-slate-700/70 shadow-sm sm:w-28 lg:top-3 lg:right-3 lg:w-40"
                notice={secondaryTile.notice}
              />
            </div>
          </div>

          <StageRecoveryOverlay status={status} onRetry={retryConnection} />

          {mediaBlocked && (
            <p className="absolute inset-x-3 top-3 max-w-96 rounded-lg bg-slate-900/90 px-3 py-2 text-xs text-slate-300 lg:inset-x-6 lg:top-6">
              카메라·마이크를 사용할 수 없어 수신 전용으로 입장했어요. 브라우저
              주소창의 권한 아이콘에서 카메라와 마이크를 허용한 뒤 다시 연결해
              주세요.
            </p>
          )}

          {/* 컨트롤은 영상 위에 얹는다 — 별도 바를 두면 영상 높이를 그만큼 빼앗긴다 */}
          <div
            className={cn(
              "absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-slate-950/90 via-slate-950/60 to-transparent px-3 pt-10 pb-4 lg:pb-6",
              // 모바일에서는 시트가 컨트롤을 덮어 나가기까지 못 누르게 되므로 시트 위로 올린다.
              // 여백이 아니라 bottom을 옮겨야 스크림이 같이 커져 영상을 덮지 않는다
              showPanel &&
                (sheetOpen ? "max-lg:bottom-90" : "max-lg:bottom-12"),
            )}
          >
            <CaptureStrip captures={captures} onSelect={setPreviewCapture} />

            {captureError && (
              <p
                role="alert"
                className="mx-auto mb-2 w-fit rounded-md bg-slate-900/90 px-3 py-1.5 text-xs text-slate-200"
              >
                {captureError}
              </p>
            )}

            <div className="flex items-center justify-center gap-2">
              <ControlButton
                on={micOn}
                label={micOn ? "마이크 끄기" : "마이크 켜기"}
                disabled={mediaBlocked}
                onClick={handleToggleMic}
              >
                {micOn ? <Mic /> : <MicOff />}
              </ControlButton>
              <ControlButton
                on={camOn}
                label={camOn ? "카메라 끄기" : "카메라 켜기"}
                disabled={mediaBlocked}
                onClick={handleToggleCam}
              >
                {camOn ? <Video /> : <VideoOff />}
              </ControlButton>
              {/* 캡처는 이 화면에서 유일한 primary — 남길 것을 남기는 동작이다 */}
              <form action={captureAction} className="contents">
                <Button
                  type="submit"
                  size="icon-lg"
                  aria-label="화면 캡처"
                  title="화면 캡처"
                  disabled={capturing}
                  className="rounded-full"
                >
                  {capturing ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Camera />
                  )}
                </Button>
              </form>
              <Button
                variant="destructive"
                size="lg"
                className="ml-2 rounded-full"
                onClick={() => setLeaveOpen(true)}
              >
                <PhoneOff /> 나가기
              </Button>
            </div>
          </div>
        </section>

        {showPanel && (
          <Card
            className={cn(
              "absolute inset-x-0 bottom-0 z-20 gap-0 rounded-b-none py-0 transition-[height] duration-200",
              "lg:relative lg:inset-auto lg:h-full lg:max-h-none lg:rounded-xl lg:py-4",
              // 펼침 높이는 뷰포트 비율이 아니라 내용 기준 — 항목 4개 + 입력창이 보이는 353px에
              // 여유를 조금 더한 값. 가로 모드처럼 낮은 화면에서는 max-h가 대신 막는다.
              // 접힘 높이는 peek 버튼(h-12) + 카드 위 테두리 1px — 안 더하면 1px 넘친다
              sheetOpen ? "h-90 max-h-[70%]" : "h-[calc(3rem+1px)]",
            )}
          >
            <button
              type="button"
              aria-expanded={sheetOpen}
              onClick={() => setSheetOpen((open) => !open)}
              className="flex h-12 w-full shrink-0 items-center justify-between px-4 text-sm font-medium lg:hidden"
            >
              <span className="flex items-center gap-1.5">
                <ListChecks className="size-4" /> {completedCount}/
                {checklistItems.length}
              </span>
              <ChevronUp
                className={cn(
                  "size-4 text-muted-foreground transition-transform",
                  sheetOpen && "rotate-180",
                )}
              />
            </button>
            <CardContent
              className={cn(
                "min-h-0 flex-1 overflow-hidden px-4 pb-4 lg:block lg:pb-0",
                sheetOpen ? "block" : "hidden",
              )}
            >
              <ChecklistPanel meetingId={meeting?.meetingId} />
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog
        open={previewCapture !== null}
        onOpenChange={(open) => !open && setPreviewCapture(null)}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">
              {previewCapture && formatCaptureTime(previewCapture.createdAt)}{" "}
              캡처
            </DialogTitle>
            <DialogDescription className="sr-only">
              이번 세션에서 남긴 캡처를 원본 크기로 봅니다.
            </DialogDescription>
          </DialogHeader>
          {previewCapture && (
            <img
              src={previewCapture.url}
              alt=""
              className="max-h-[60svh] w-full rounded-lg bg-slate-900 object-contain"
            />
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={deletePreviewCapture}>
              <Trash2 /> 삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>점검을 끝낼까요?</DialogTitle>
            <DialogDescription>
              나가면 통화가 끊기고 상대방은 혼자 남습니다.
              {showPanel && " 체크리스트는 그대로 저장돼 있어요."}
              {captures.length > 0 &&
                ` 이번 세션에서 남긴 캡처 ${captures.length}장은 사라집니다.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeaveOpen(false)}>
              계속 점검하기
            </Button>
            <Button variant="destructive" onClick={leaveSession}>
              <PhoneOff /> 나가기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

export default ReservationLivePage;
