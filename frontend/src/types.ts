export type DealType = "전세" | "월세" | "매매";
export type BuildingType = "아파트" | "오피스텔" | "빌라" | "원룸";

export type FacilityCategory =
  "지하철" | "편의점" | "카페" | "빨래방" | "마트" | "약국";

export interface NearbyFacility {
  id: string;
  category: FacilityCategory;
  name: string;
  distanceM: number;
  walkingMinutes: number;
  direction: string;
  address: string;
  latitude?: number;
  longitude?: number;
}

export interface Property {
  id: number;
  brokerId: number;
  title: string;
  dealType: DealType;
  buildingType: BuildingType;
  deposit: number;
  monthlyRent: number;
  region: string;
  dong: string;
  areaM2: number;
  floor: number;
  totalFloors?: number;
  rooms: number;
  saved: boolean;
  imageUrl?: string;
  imageUrls?: string[];
  nearbyFacilities?: NearbyFacility[];
}

// ── 매물 API 계약 (Swagger /api/properties) ──────────────────────────────
// 백엔드 roomType enum이 허용하는 값 — BuildingType 중 "아파트"는 아직 미지원
export type RoomType = Exclude<BuildingType, "아파트">;

export interface Page<T> {
  content: T[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

export interface PagingParams {
  page?: number;
  size?: number;
  // Spring 정렬 표기 — "createdAt,DESC"
  sort?: string;
}

export interface PropertyFilters {
  query?: string;
  sigungu?: string;
  transactionType?: DealType;
  roomType?: RoomType;
  minDeposit?: number;
  maxDeposit?: number;
}

export interface MapBounds {
  swLat: number;
  swLng: number;
  neLat: number;
  neLng: number;
}

export interface PropertySummary {
  propertyId: number;
  title: string;
  transactionType: DealType;
  roomType: RoomType;
  deposit: number;
  monthlyRent: number;
  sigungu: string;
  dong: string;
  complexName?: string;
  area?: number;
  floor?: number;
  totalFloor?: number;
  status: string;
  saved: boolean;
  // 사진은 백엔드 목록 응답에 아직 없다 — 지금은 목데이터에서 채운다
  imageUrl?: string;
}

export interface PropertyDetail extends PropertySummary {
  maintenanceFee?: number;
  lotNumber?: string;
  roadAddress?: string;
  builtYear?: number;
  latitude?: number;
  longitude?: number;
  description?: string;
  createdAt: string;
  // 방 개수·사진·주변 편의시설은 백엔드 상세 응답에 아직 없다 — 지금은 목데이터에서 채운다
  rooms?: number;
  imageUrls?: string[];
  nearbyFacilities?: NearbyFacility[];
}

export interface PropertyMapPin {
  propertyId: number;
  title: string;
  latitude: number;
  longitude: number;
  transactionType: DealType;
  deposit: number;
  monthlyRent: number;
}

// property_environment 테이블 — 주소 좌표를 기준으로 카카오 장소 검색에서 집계한다
export interface PropertyEnvironment {
  nearestStationName?: string;
  stationDistanceMeter?: number;
  stationWalkingMinutes?: number;
  convenienceStoreCount: number;
  martCount: number;
  hospitalCount: number;
  pharmacyCount: number;
  cafeCount: number;
  policeCount: number;
  parkCount: number;
  bankCount: number;
  laundryCount: number;
  schoolCount: number;
}

// latitude·longitude는 주소 입력 시 카카오 좌표 변환으로 채운다 (src/lib/kakaoLocal.ts)
// rooms·environment는 백엔드 PropertyCreateRequest에 아직 없는 필드다 — 스키마가 확장되기 전까지는 서버가 무시한다.
// 사진은 JSON이 아니라 등록 직후 multipart 업로드(uploadPropertyImages)로 따로 보낸다
export interface PropertyCreateInput {
  title: string;
  transactionType: DealType;
  roomType: RoomType;
  deposit: number;
  monthlyRent?: number;
  maintenanceFee?: number;
  sigungu: string;
  dong: string;
  lotNumber?: string;
  roadAddress?: string;
  complexName?: string;
  builtYear?: number;
  latitude?: number;
  longitude?: number;
  area?: number;
  floor?: number;
  totalFloor?: number;
  description?: string;
  rooms?: number;
  environment?: PropertyEnvironment;
}

export interface Reservation {
  id: string;
  propertyId: number;
  date: string;
  time: string;
  timeOptions: string[];
  status: "예약 확정" | "예약 대기";
  direction: "sent" | "received";
}

export interface PriceBand {
  value: string;
  label: string;
  min: number;
  max: number;
}

export interface Memo {
  id: number;
  text: string;
  createdAt: string;
}
export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface Filters {
  query: string;
  dealType: string;
  region: string;
  price: string;
  rent: string;
  buildingType: string;
}

export type AuthProvider = "kakao" | "google";

export type UserRole = "세입자" | "중개사" | "관리자";

export type BrokerVerificationStatus =
  "미신청" | "심사 중" | "승인 완료" | "반려";

export interface User {
  id: number;
  name: string;
  birth: string;
  nickname: string;
  email: string;
  phone: string;
  profileImageUrl?: string;
  role: UserRole;
  brokerVerification: BrokerVerificationStatus;
  brokerVerificationRejectReason?: string;
  provider: AuthProvider;
}

export type UserProfileChanges = Pick<
  User,
  "birth" | "nickname" | "phone" | "profileImageUrl"
>;

export interface BrokerVerificationRequest {
  registrationNumber: string;
  documentName: string;
}

export type BrokerApplicationStatus = "심사 중" | "승인 완료" | "반려";

export interface BrokerApplicationDocument {
  type: string;
  fileName: string;
  previewUrl: string;
}

// ADMIN-01~03 중개사 인증 신청 건 — 관리자 심사 대상
export interface BrokerApplication {
  id: number;
  applicantId: number;
  applicantName: string;
  nickname: string;
  email: string;
  phone: string;
  registrationNumber: string;
  documents: BrokerApplicationDocument[];
  status: BrokerApplicationStatus;
  appliedAt: string;
  processedAt?: string;
  rejectReason?: string;
}
