import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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

// PAGE-11·12 RTC 세션 — RTC-02 입장, RTC-03 퇴장. 시그널링은 dev 서버의 /signal 릴레이 사용.
function ReservationLivePage() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const [status, setStatus] = useState<SessionStatus>("connecting");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [mediaBlocked, setMediaBlocked] = useState(false);

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
      setMediaBlocked(!localStream);
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
    <div className="min-h-svh bg-background">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              라이브 세션
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              세션 코드: {slug}
            </p>
          </div>
          <Badge variant={status === "connected" ? "default" : "secondary"}>
            {STATUS_LABEL[status]}
          </Badge>
        </div>

        {mediaBlocked && (
          <p className="mt-4 rounded-xl bg-muted p-4 text-sm text-muted-foreground">
            카메라·마이크를 사용할 수 없어 수신 전용으로 입장했어요. 브라우저
            권한을 확인해 주세요.
          </p>
        )}

        <div className="relative mt-6 overflow-hidden rounded-xl bg-muted">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="h-[calc(100svh-18rem)] min-h-80 w-full object-cover"
          />
          <span className="absolute bottom-2 left-2 rounded-md bg-background/80 px-2 py-0.5 text-sm text-foreground">
            상대방
          </span>
          <div className="absolute top-4 right-4 w-36 overflow-hidden rounded-xl border bg-muted shadow-sm md:w-52">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="aspect-video w-full object-cover"
            />
            <span className="absolute bottom-1 left-1 rounded-md bg-background/80 px-1.5 py-0.5 text-sm text-foreground">
              나
            </span>
          </div>
        </div>

        <div className="mt-6 flex justify-center gap-2">
          <Button
            variant={micOn ? "outline" : "secondary"}
            size="icon-lg"
            aria-label={micOn ? "마이크 끄기" : "마이크 켜기"}
            disabled={mediaBlocked}
            onClick={handleToggleMic}
          >
            {micOn ? <Mic /> : <MicOff />}
          </Button>
          <Button
            variant={camOn ? "outline" : "secondary"}
            size="icon-lg"
            aria-label={camOn ? "카메라 끄기" : "카메라 켜기"}
            disabled={mediaBlocked}
            onClick={handleToggleCam}
          >
            {camOn ? <Video /> : <VideoOff />}
          </Button>
          <Button
            variant="destructive"
            size="lg"
            onClick={() => navigate("/reservations")}
          >
            <PhoneOff />
            나가기
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ReservationLivePage;
