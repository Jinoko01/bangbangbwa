import { useEffect, useState } from "react";
import { Route, Routes, useNavigate, useParams } from "react-router-dom";

import GlobalNav from "@/components/GlobalNav";
import { AuthProvider } from "@/context/AuthContext";
import LandingPage from "@/pages/LandingPage";
import LoginPage from "@/pages/LoginPage";
import PropertyDetailPage from "@/pages/PropertyDetailPage";
import PropertyListPage from "@/pages/PropertyListPage";
import ReservationLivePage from "@/pages/ReservationLivePage";
import ReservationPage from "@/pages/ReservationPage";
import { PROPERTIES } from "@/data/properties";
import type { Memo, Property } from "@/types";

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
  memoActions: MemoActions;
}

function DetailRoute({
  loading,
  properties,
  memos,
  onToggleSave,
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
    <AuthProvider>
      <GlobalNav />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/reservation" element={<ReservationPage />} />
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
              memoActions={memoActions}
            />
          }
        />
      </Routes>
    </AuthProvider>
  );
}

export default App;
