export type DealType = "전세" | "월세" | "매매";
export type BuildingType = "아파트" | "오피스텔" | "빌라" | "원룸";

export interface Property {
  id: number;
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
  region: string;
  price: string;
  buildingType: string;
}

export type AuthProvider = "kakao" | "google";

export type UserRole = "세입자" | "중개사";

export type BrokerVerificationStatus = "미신청" | "심사 중" | "승인 완료";

export interface User {
  name: string;
  birth: string;
  nickname: string;
  email: string;
  phone: string;
  profileImageUrl?: string;
  role: UserRole;
  brokerVerification: BrokerVerificationStatus;
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
