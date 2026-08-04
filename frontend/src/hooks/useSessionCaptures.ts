import { type RefObject, useEffect, useRef, useState } from "react";

export interface SessionCapture {
  id: string;
  url: string;
  image: Blob;
  createdAt: string;
}

// RTC-05 화면 캡처 — 영상 프레임을 캔버스로 옮겨 blob으로 남긴다.
// 미리보기용 object URL과 서버 업로드용 원본 Blob을 함께 보관한다.
// object URL은 화면을 떠날 때 해제하지만 Blob은 캡처 저장 API에 그대로 전달한다.
export function useSessionCaptures(
  videoRef: RefObject<HTMLVideoElement | null>,
) {
  const [captures, setCaptures] = useState<SessionCapture[]>([]);
  const capturesRef = useRef(captures);

  useEffect(() => {
    capturesRef.current = captures;
  }, [captures]);

  useEffect(
    () => () => {
      capturesRef.current.forEach(({ url }) => URL.revokeObjectURL(url));
    },
    [],
  );

  // 영상이 아직 프레임을 그리기 전이면 빈 이미지가 남으므로 캡처하지 않는다
  const capture = async () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) {
      return null;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      return null;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/png");
    });
    if (!blob) {
      return null;
    }

    const captured: SessionCapture = {
      id: crypto.randomUUID(),
      url: URL.createObjectURL(blob),
      image: blob,
      createdAt: new Date().toISOString(),
    };
    setCaptures((current) => [...current, captured]);
    return captured;
  };

  const removeCapture = (captureId: string) => {
    const target = capturesRef.current.find(({ id }) => id === captureId);
    if (target) {
      URL.revokeObjectURL(target.url);
    }
    setCaptures((current) => current.filter(({ id }) => id !== captureId));
  };

  return { captures, capture, removeCapture };
}
