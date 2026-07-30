import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Navigate,
  Route,
  Routes,
  matchPath,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";

import GlobalNav from "@/components/GlobalNav";
import RequireAuth from "@/components/RequireAuth";
import AdminPage from "@/pages/AdminPage";
import LandingPage from "@/pages/LandingPage";
import LoginPage from "@/pages/LoginPage";
import MyPage from "@/pages/MyPage";
import OAuthCallbackPage from "@/pages/OAuthCallbackPage";
import PropertyDetailPage from "@/pages/PropertyDetailPage";
import PropertyFormPage from "@/pages/PropertyFormPage";
import PropertyListPage from "@/pages/PropertyListPage";
import ReservationLivePage from "@/pages/ReservationLivePage";
import ReservationPage from "@/pages/ReservationPage";
import BookingPage from "@/pages/BookingPage";
import SavedPropertiesPage from "@/pages/SavedPropertiesPage";
import { removeMockProperty, upsertMockProperty } from "@/data/mockPropertyApi";
import { PROPERTIES } from "@/data/properties";
import {
  propertyKeys,
  useMyPropertyList,
} from "@/hooks/queries/propertyQueries";
import { isApprovedBroker } from "@/lib/auth";
import { useAuthStore } from "@/stores/authStore";
import type { Memo, Property } from "@/types";

// API 연동 전 목데이터 로딩 시뮬레이션 시간(ms)
const MOCK_LOADING_MS = 600;

// ADMIN 페이지 가드 — 관리자 계정이 아니면 랜딩으로 돌려보낸다
function AdminRoute() {
  const user = useAuthStore((state) => state.user);
  if (user?.role !== "관리자") {
    return <Navigate to="/" replace />;
  }
  return <AdminPage />;
}

interface MemoActions {
  add: (propertyId: number, text: string) => void;
  update: (propertyId: number, memoId: number, text: string) => void;
  remove: (propertyId: number, memoId: number) => void;
}

interface DetailRouteProps {
  memos: Record<number, Memo[]>;
  onReserve: (id: number) => void;
  onDelete: (id: number) => void;
  memoActions: MemoActions;
}

function DetailRoute({
  memos,
  onReserve,
  onDelete,
  memoActions,
}: DetailRouteProps) {
  const { id: idParam } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const id = Number(idParam);
  // 매물 상세 응답에 등록 중개사 정보가 없어, 내 매물 목록에 있는지로 관리 권한을 판단한다
  const canManage = isApprovedBroker(user);
  const { data: myProperties } = useMyPropertyList({}, canManage);
  const isMyProperty = Boolean(
    myProperties?.content.some((property) => property.propertyId === id),
  );

  return (
    <PropertyDetailPage
      propertyId={id}
      canManage={canManage && isMyProperty}
      // 히스토리 뒤로가기로 지도 탭·찜 목록 등 이전 화면을 유지, 직접 진입 시엔 목록으로 폴백
      onBack={() =>
        location.key === "default" ? navigate("/properties") : navigate(-1)
      }
      onReserve={onReserve}
      onEdit={() => navigate(`/properties/${id}/edit`)}
      onDelete={() => {
        onDelete(id);
        navigate("/properties", { replace: true });
      }}
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
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const restoreSession = useAuthStore((state) => state.restoreSession);
  const location = useLocation();
  // 라이브 세션 중에는 GNB 링크 한 번에 확인 없이 통화가 끊기므로 아예 노출하지 않는다.
  // 이 화면을 벗어나는 길은 확인 다이얼로그가 붙은 나가기 버튼 하나뿐이다
  const hideGlobalNav = matchPath("/reservation/:slug", location.pathname);

  useEffect(() => {
    const timer = setTimeout(() => {
      setProperties(PROPERTIES);
      setLoading(false);
    }, MOCK_LOADING_MS);
    return () => clearTimeout(timer);
  }, []);

  // 저장된 accessToken이 있으면 내 정보 조회로 로그인 상태 복원
  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  // PROP-07·08 매물 등록·수정 — 같은 id가 있으면 교체, 없으면 맨 앞에 추가.
  // 목록·상세는 목데이터 사본을 따로 보므로 그쪽에도 같은 변경을 반영한다
  const saveProperty = (property: Property) => {
    setProperties((prev) =>
      prev.some((p) => p.id === property.id)
        ? prev.map((p) => (p.id === property.id ? property : p))
        : [property, ...prev],
    );
    upsertMockProperty(property);
    queryClient.invalidateQueries({ queryKey: propertyKeys.all });
  };

  // PROP-09 매물 삭제 — 연결된 메모도 함께 정리 (회의는 서버가 소유한다)
  const deleteProperty = (id: number) => {
    setProperties((prev) => prev.filter((p) => p.id !== id));
    setMemos((prev) => {
      const { [id]: _removed, ...rest } = prev;
      return rest;
    });
    removeMockProperty(id);
    queryClient.invalidateQueries({ queryKey: propertyKeys.all });
  };

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
      {!hideGlobalNav && <GlobalNav />}
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/oauth/callback/:provider"
          element={<OAuthCallbackPage />}
        />
        <Route path="/admin" element={<AdminRoute />} />
        <Route
          path="/mypage"
          element={
            <RequireAuth>{(user) => <MyPage user={user} />}</RequireAuth>
          }
        />
        <Route
          path="/reservations"
          element={<RequireAuth>{() => <ReservationPage />}</RequireAuth>}
        />
        <Route
          path="/booking/:id"
          element={<RequireAuth>{() => <BookingPage />}</RequireAuth>}
        />
        <Route
          path="/saved"
          element={
            <RequireAuth>{() => <SavedPropertiesPage />}</RequireAuth>
          }
        />
        <Route
          path="/reservation/:slug"
          element={<RequireAuth>{() => <ReservationLivePage />}</RequireAuth>}
        />
        <Route
          path="/properties"
          element={
            <PropertyListPage
              canCreate={isApprovedBroker(user)}
              onOpen={(id) => navigate(`/properties/${id}`)}
              onCreate={() => navigate("/properties/new")}
            />
          }
        />
        <Route
          path="/properties/new"
          element={
            <RequireAuth>
              {(user) => (
                <PropertyFormPage
                  user={user}
                  loading={loading}
                  properties={properties}
                  onSave={saveProperty}
                />
              )}
            </RequireAuth>
          }
        />
        <Route
          path="/properties/:id/edit"
          element={
            <RequireAuth>
              {(user) => (
                <PropertyFormPage
                  user={user}
                  loading={loading}
                  properties={properties}
                  onSave={saveProperty}
                />
              )}
            </RequireAuth>
          }
        />
        <Route
          path="/properties/:id"
          element={
            <DetailRoute
              memos={memos}
              onReserve={(id) => navigate(`/booking/${id}`)}
              onDelete={deleteProperty}
              memoActions={memoActions}
            />
          }
        />
      </Routes>
    </>
  );
}

export default App;
