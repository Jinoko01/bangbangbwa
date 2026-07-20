import { useEffect, useState } from "react";
import { Route, Routes, useNavigate, useParams } from "react-router-dom";

import GlobalNav from "@/components/GlobalNav";
import LandingPage from "@/pages/LandingPage";
import LoginPage from "@/pages/LoginPage";
import MyPage from "@/pages/MyPage";
import PropertyDetailPage from "@/pages/PropertyDetailPage";
import PropertyListPage from "@/pages/PropertyListPage";
import ReservationLivePage from "@/pages/ReservationLivePage";
import ReservationPage from "@/pages/ReservationPage";
import BookingPage from "@/pages/BookingPage";
import SavedPropertiesPage from "@/pages/SavedPropertiesPage";
import { PROPERTIES } from "@/data/properties";
import type { Memo, Property, Reservation } from "@/types";

// API 연동 전 목데이터 로딩 시뮬레이션 시간(ms)
const MOCK_LOADING_MS = 600;

interface MemoActions {
  add: (propertyId: number, text: string) => void;
  update: (propertyId: number, memoId: number, text: string) => void;
  remove: (propertyId: number, memoId: number) => void;
}

interface DetailRouteProps {
  loading: boolean;
  properties: Property[];
  memos: Record<number, Memo[]>;
  onToggleSave: (id: number) => void;
  onReserve: (id: number) => void;
  memoActions: MemoActions;
}

function DetailRoute({
  loading,
  properties,
  memos,
  onToggleSave,
  onReserve,
  memoActions,
}: DetailRouteProps) {
  const { id: idParam } = useParams();
  const navigate = useNavigate();
  const id = Number(idParam);
  const property = properties.find((p) => p.id === id) ?? null;

  return (
    <PropertyDetailPage
      property={property}
      loading={loading}
      onBack={() => navigate("/properties")}
      onToggleSave={onToggleSave}
      onReserve={onReserve}
      memos={memos[id] ?? []}
      onAddMemo={(text) => memoActions.add(id, text)}
      onUpdateMemo={(memoId, text) => memoActions.update(id, memoId, text)}
      onDeleteMemo={(memoId) => memoActions.remove(id, memoId)}
    />
  );
}

function App() {
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<Property[]>([]);
  const [memos, setMemos] = useState<Record<number, Memo[]>>({});
  const [reservations, setReservations] = useState<Reservation[]>([
    {
      id: "reservation-demo-0918",
      propertyId: 2,
      date: "2026-07-19",
      time: "10:00, 13:00, 16:00",
      status: "예약 대기",
      direction: "sent",
    },
    {
      id: "reservation-demo-1024",
      propertyId: 1,
      date: "2026-07-18",
      time: "14:00",
      status: "예약 확정",
      direction: "received",
    },
  ]);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      setProperties(PROPERTIES);
      setLoading(false);
    }, MOCK_LOADING_MS);
    return () => clearTimeout(timer);
  }, []);

  // PROP-04·05 매물 저장·저장 취소
  const toggleSave = (id: number) =>
    setProperties((prev) =>
      prev.map((p) => (p.id === id ? { ...p, saved: !p.saved } : p)),
    );

  // MEMO-01~03 메모 작성·수정·삭제
  const memoActions: MemoActions = {
    add: (propertyId, text) =>
      setMemos((prev) => ({
        ...prev,
        [propertyId]: [
          ...(prev[propertyId] ?? []),
          { id: Date.now(), text, createdAt: new Date().toISOString() },
        ],
      })),
    update: (propertyId, memoId, text) =>
      setMemos((prev) => ({
        ...prev,
        [propertyId]: prev[propertyId].map((m) =>
          m.id === memoId ? { ...m, text } : m,
        ),
      })),
    remove: (propertyId, memoId) =>
      setMemos((prev) => ({
        ...prev,
        [propertyId]: prev[propertyId].filter((m) => m.id !== memoId),
      })),
  };

  return (
    <>
      <GlobalNav />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/mypage" element={<MyPage />} />
        <Route
          path="/reservations"
          element={
            <ReservationPage
              reservations={reservations}
              properties={properties}
            />
          }
        />
        <Route
          path="/booking/:id"
          element={
            <BookingPage
              properties={properties}
              onConfirm={(reservation) =>
                setReservations((previous) => [reservation, ...previous])
              }
            />
          }
        />
        <Route
          path="/saved"
          element={
            <SavedPropertiesPage
              properties={properties}
              onToggleSave={toggleSave}
            />
          }
        />
        <Route path="/reservation/:slug" element={<ReservationLivePage />} />
        <Route
          path="/properties"
          element={
            <PropertyListPage
              loading={loading}
              properties={properties}
              onToggleSave={toggleSave}
              onOpen={(id) => navigate(`/properties/${id}`)}
            />
          }
        />
        <Route
          path="/properties/:id"
          element={
            <DetailRoute
              loading={loading}
              properties={properties}
              memos={memos}
              onToggleSave={toggleSave}
              onReserve={(id) => navigate(`/booking/${id}`)}
              memoActions={memoActions}
            />
          }
        />
      </Routes>
    </>
  );
}

export default App;
