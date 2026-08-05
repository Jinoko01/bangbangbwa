import type {
  Meeting,
  MeetingDirection,
  MeetingStatus,
  PreferredRank,
} from "@/types";

// 백엔드 MeetingCreateRequest.preferredTimes의 maxItems
export const MAX_PREFERRED_TIMES = 3;

export const PREFERRED_RANKS: PreferredRank[] = [1, 2, 3];

// OPEN·REQUESTED 모두 중개사의 확정을 기다리는 상태라 같은 문구로 묶는다
export const MEETING_STATUS_LABEL: Record<MeetingStatus, string> = {
  OPEN: "예약 대기",
  REQUESTED: "예약 대기",
  CONFIRMED: "예약 확정",
  COMPLETED: "미팅 완료",
  REJECTED: "요청 거절",
  CANCELED: "예약 취소",
};

// 확정 전이라 중개사는 확정·거절, 세입자는 희망 시간 수정을 할 수 있는 상태
export function isPendingMeeting({ status }: Pick<Meeting, "status">) {
  return status === "OPEN" || status === "REQUESTED";
}

export function isActiveMeeting({ status }: Pick<Meeting, "status">) {
  return status !== "REJECTED" && status !== "CANCELED";
}

export function isPastMeeting(meeting: Meeting) {
  // 탭은 날짜가 아니라 예약 상태로 나눈다. 대기·확정 건은 미팅 시각이
  // 지났더라도 완료 처리 전까지 계속 예정 예약에서 확인할 수 있어야 한다.
  return (
    meeting.status === "COMPLETED" ||
    meeting.status === "REJECTED" ||
    meeting.status === "CANCELED"
  );
}

// 두 자리 0 패딩 없이 Date를 백엔드 LocalDateTime 표기로 직렬화한다.
// toISOString()은 UTC로 변환되면서 날짜가 밀리므로 로컬 값을 그대로 조립한다
export function toLocalDateTime(date: Date) {
  return `${toDateKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function toDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// 서버가 초·밀리초 자리를 붙여 보내도 같은 시각이면 같은 키가 되도록 정규화한다
export function toSlotKey(localDateTime: string) {
  return toLocalDateTime(new Date(localDateTime));
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

// 채워진 희망 시간만 순위와 함께 꺼낸다 (1~3순위 중 일부만 등록될 수 있다)
export function getPreferredTimes(meeting: Meeting) {
  return [meeting.preferredAt1, meeting.preferredAt2, meeting.preferredAt3]
    .map((at, index) => ({ rank: PREFERRED_RANKS[index], at }))
    .filter((option): option is { rank: PreferredRank; at: string } =>
      Boolean(option.at),
    );
}

// 목록 정렬·표시 기준 시각 — 확정 전에는 가장 이른 희망 시간을 대표로 쓴다
export function getMeetingDateTime(meeting: Meeting) {
  if (meeting.scheduledAt) {
    return meeting.scheduledAt;
  }
  const [earliest] = getPreferredTimes(meeting)
    .map(({ at }) => at)
    .sort();
  return earliest;
}

export function getMeetingDirection(
  meeting: Meeting,
  userId: number | undefined,
): MeetingDirection {
  return meeting.agentId === userId ? "received" : "sent";
}

// 상태와 무관하게 시각만 기준으로 정렬한다. 다가오는 미팅은 가까운 순으로 먼저,
// 이미 지난 시각은 그 뒤에서 최근 순으로 둔다. 시각이 없으면 항상 마지막이다.
export function compareByNearest(first: Meeting, second: Meeting) {
  const now = Date.now();
  const firstTime = toTimestamp(first);
  const secondTime = toTimestamp(second);
  const firstIsUpcoming = firstTime >= now;
  const secondIsUpcoming = secondTime >= now;

  if (firstIsUpcoming !== secondIsUpcoming) {
    return firstIsUpcoming ? -1 : 1;
  }
  return firstIsUpcoming ? firstTime - secondTime : secondTime - firstTime;
}

function toTimestamp(meeting: Meeting) {
  const at = getMeetingDateTime(meeting);
  return at ? new Date(at).getTime() : Number.MAX_SAFE_INTEGER;
}

const dayFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "short",
});

const timeFormatter = new Intl.DateTimeFormat("ko-KR", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatMeetingDay(localDateTime: string) {
  return dayFormatter.format(new Date(localDateTime));
}

export function formatMeetingTime(localDateTime: string) {
  return timeFormatter.format(new Date(localDateTime));
}

export function formatMeetingDateTime(localDateTime: string) {
  return `${formatMeetingDay(localDateTime)} ${formatMeetingTime(localDateTime)}`;
}

// 목록 카드처럼 좁은 자리용 — "8월 1일 (금) 14:00"
const shortDayFormatter = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
  weekday: "short",
});

export function formatMeetingShort(localDateTime: string) {
  const date = new Date(localDateTime);
  return `${shortDayFormatter.format(date)} ${timeFormatter.format(date)}`;
}
