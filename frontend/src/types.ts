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
