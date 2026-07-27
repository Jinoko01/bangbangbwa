import type { BrokerApplication } from "@/types";

// ADMIN-01 중개사 인증 신청 목데이터 — 심사 중 3건 + 처리 완료 2건.
// documents.previewUrl은 실제 서류 업로드 연동 전 임시 이미지.
const DOCUMENT_IMAGES = [
  "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=900&q=80",
];

export const BROKER_APPLICATIONS: BrokerApplication[] = [
  {
    id: 1,
    applicantId: 101,
    applicantName: "최공인",
    nickname: "믿음부동산",
    email: "trust@example.com",
    phone: "010-1111-2222",
    registrationNumber: "11680-2026-00415",
    documents: [
      {
        type: "중개사무소 등록증",
        fileName: "중개사무소등록증_최공인.jpg",
        previewUrl: DOCUMENT_IMAGES[0],
      },
      {
        type: "사업자등록증",
        fileName: "사업자등록증_믿음부동산.jpg",
        previewUrl: DOCUMENT_IMAGES[1],
      },
    ],
    status: "심사 중",
    appliedAt: "2026-07-25",
  },
  {
    id: 2,
    applicantId: 102,
    applicantName: "정매물",
    nickname: "한강뷰공인",
    email: "hangang@example.com",
    phone: "010-3333-4444",
    registrationNumber: "11170-2026-00082",
    documents: [
      {
        type: "중개사무소 등록증",
        fileName: "등록증_정매물.png",
        previewUrl: DOCUMENT_IMAGES[2],
      },
    ],
    status: "심사 중",
    appliedAt: "2026-07-26",
  },
  {
    id: 3,
    applicantId: 103,
    applicantName: "오계약",
    nickname: "성수동공인",
    email: "seongsu@example.com",
    phone: "010-5555-6666",
    registrationNumber: "1120-26-3",
    documents: [
      {
        type: "사업자등록증",
        fileName: "사업자등록증_오계약.jpg",
        previewUrl: DOCUMENT_IMAGES[1],
      },
    ],
    status: "심사 중",
    appliedAt: "2026-07-27",
  },
  {
    id: 4,
    applicantId: 1,
    applicantName: "박중개",
    nickname: "방방부동산",
    email: "broker@example.com",
    phone: "010-9876-5432",
    registrationNumber: "11680-2025-00231",
    documents: [
      {
        type: "중개사무소 등록증",
        fileName: "중개사무소등록증_박중개.jpg",
        previewUrl: DOCUMENT_IMAGES[0],
      },
    ],
    status: "승인 완료",
    appliedAt: "2026-07-10",
    processedAt: "2026-07-11",
  },
  {
    id: 5,
    applicantId: 104,
    applicantName: "임허위",
    nickname: "번개공인",
    email: "fast@example.com",
    phone: "010-7777-8888",
    registrationNumber: "99999-2026-00001",
    documents: [
      {
        type: "사업자등록증",
        fileName: "서류사진.jpg",
        previewUrl: DOCUMENT_IMAGES[2],
      },
    ],
    status: "반려",
    appliedAt: "2026-07-18",
    processedAt: "2026-07-19",
    rejectReason:
      "중개업등록번호가 정부 조회 결과와 일치하지 않습니다. 등록증 원본을 다시 확인해 주세요.",
  },
];
