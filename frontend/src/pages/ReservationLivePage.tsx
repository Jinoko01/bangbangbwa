import {
  type FormEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  CameraOff,
  ListChecks,
  Loader2,
  Lock,
  Mic,
  MicOff,
  NotebookPen,
  Pencil,
  PhoneOff,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useReservationChecklist } from "@/hooks/useReservationChecklist";
import { useSessionMemos } from "@/hooks/useSessionMemos";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import type { Memo, Property, Reservation, UserRole } from "@/types";

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

const PEER_ROLE: Record<UserRole, UserRole> = {
  세입자: "중개사",
  중개사: "세입자",
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

function formatMemoTime(iso: string) {
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
  notice?: ReactNode;
}

function VideoTile({
  videoRef,
  label,
  className,
  muted = false,
  notice,
}: VideoTileProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg bg-slate-900",
        className,
      )}
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
        compact && "gap-1 px-2 text-xs",
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

// 상대방 영상이 오기 전까지 세션 상태를 대신 보여준다
function RemoteTileNotice({ status }: { status: SessionStatus }) {
  if (status === "connected") {
    return null;
  }

  const isPreparing = status === "connecting" || status === "waiting";

  return (
    <TileNotice
      icon={
        isPreparing ? (
          <Loader2 className="size-6 animate-spin" />
        ) : (
          <VideoOff className="size-6" />
        )
      }
    >
      {STATUS_LABEL[status]}
    </TileNotice>
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
        !on && "border-transparent bg-destructive hover:bg-destructive/90",
      )}
    >
      {children}
    </Button>
  );
}

// 세션 중 본인만 볼 수 있는 메모 — 작성·수정·삭제
interface SessionMemoPanelProps {
  memos: Memo[];
  onAdd: (text: string) => void;
  onUpdate: (memoId: number, text: string) => void;
  onDelete: (memoId: number) => void;
}

function SessionMemoPanel({
  memos,
  onAdd,
  onUpdate,
  onDelete,
}: SessionMemoPanelProps) {
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
    <div className="rounded-xl border bg-slate-50/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <strong className="text-sm text-slate-900">나만 보는 메모</strong>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="size-3" /> 상대방에게는 보이지 않아요.
          </p>
        </div>
        <Badge variant="secondary">{memos.length}개</Badge>
      </div>

      {memos.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed bg-white px-3 py-6 text-center text-xs text-muted-foreground">
          아직 작성한 메모가 없습니다. 통화 중 남기고 싶은 내용을 적어보세요.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {memos.map((memo) => (
            <li key={memo.id} className="rounded-lg border bg-white p-3">
              {editingId === memo.id ? (
                <div className="flex flex-col gap-2">
                  <Textarea
                    value={editText}
                    onChange={(event) => setEditText(event.target.value)}
                    aria-label="메모 수정"
                    className="min-h-20 bg-white text-sm"
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
                      {formatMemoTime(memo.createdAt)}
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

      <form className="mt-3 flex flex-col gap-2" onSubmit={handleSubmit}>
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="확인한 하자, 물어볼 내용을 적어두세요"
          aria-label="메모 내용"
          className="min-h-20 bg-white text-sm"
        />
        <Button
          type="submit"
          size="sm"
          className="h-10"
          disabled={!draft.trim()}
        >
          <NotebookPen /> 메모 저장
        </Button>
      </form>
    </div>
  );
}

interface ReservationLivePageProps {
  reservations: Reservation[];
  properties: Property[];
}

// PAGE-12 RTC 회의 — RTC-02 입장, RTC-03 퇴장. 시그널링은 dev 서버의 /signal 릴레이 사용.
function ReservationLivePage({
  reservations,
  properties,
}: ReservationLivePageProps) {
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
  const mediaBlocked = mediaStatus === "blocked";

  const reservation = reservations.find(({ id }) => id === slug);
  const property = properties.find(({ id }) => id === reservation?.propertyId);
  const { items: checklist, setItems: setChecklist } =
    useReservationChecklist(slug);
  const { memos, addMemo, updateMemo, removeMemo } = useSessionMemos(slug);

  const myLabel = user ? `나 (${user.role})` : "나";
  const peerLabel = user ? PEER_ROLE[user.role] : "상대방";

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
  }, [slug]);

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
    <main className="min-h-[calc(100svh-3.5rem)] bg-slate-50/70">
      <section className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-xl font-semibold">
                {property?.title ?? "라이브 점검"}
              </h1>
              <Badge variant={STATUS_BADGE_VARIANT[status]}>
                {STATUS_LABEL[status]}
              </Badge>
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {reservation
                ? `${reservation.date} · ${reservation.time} · `
                : null}
              세션 코드 {slug}
            </p>
          </div>
          {user && (
            <Badge variant="secondary" className="hidden sm:flex">
              <Users /> {myLabel} · {peerLabel}
            </Badge>
          )}
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 lg:grid-cols-[minmax(0,1fr)_370px]">
        <section className="rounded-xl border bg-slate-950 p-3 shadow-sm">
          <div className="relative">
            <VideoTile
              videoRef={remoteVideoRef}
              label={peerLabel}
              className="aspect-video lg:aspect-auto lg:h-[calc(100svh-16rem)] lg:min-h-96"
              notice={<RemoteTileNotice status={status} />}
            />
            <VideoTile
              videoRef={localVideoRef}
              label={myLabel}
              muted
              className="absolute top-3 right-3 aspect-video w-36 border border-slate-700 shadow-sm md:w-52"
              notice={
                <LocalTileNotice mediaStatus={mediaStatus} camOn={camOn} />
              }
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 rounded-lg bg-slate-900 p-2">
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
            <Button
              variant="destructive"
              size="lg"
              className="ml-2 rounded-full"
              onClick={() => navigate("/reservations")}
            >
              <PhoneOff /> 나가기
            </Button>
          </div>

          {mediaBlocked && (
            <p className="mt-3 rounded-lg bg-slate-900 px-4 py-3 text-center text-xs text-slate-400">
              카메라·마이크를 사용할 수 없어 수신 전용으로 입장했어요. 브라우저
              권한을 확인해 주세요.
            </p>
          )}
        </section>

        <Card className="gap-3 py-4 lg:sticky lg:top-4 lg:max-h-[calc(100svh-6rem)] lg:self-start lg:overflow-y-auto">
          <CardContent className="px-4">
            <Tabs defaultValue="checklist">
              <TabsList className="w-full">
                <TabsTrigger value="checklist">
                  <ListChecks /> 체크리스트
                </TabsTrigger>
                <TabsTrigger value="memo">
                  <NotebookPen /> 메모
                </TabsTrigger>
              </TabsList>
              <TabsContent value="checklist">
                <ReservationChecklist
                  items={checklist}
                  onChange={setChecklist}
                />
              </TabsContent>
              <TabsContent value="memo">
                <SessionMemoPanel
                  memos={memos}
                  onAdd={addMemo}
                  onUpdate={updateMemo}
                  onDelete={removeMemo}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default ReservationLivePage;
