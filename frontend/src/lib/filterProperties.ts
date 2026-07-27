import {
  MONTHLY_DEPOSIT_BANDS,
  PRICE_BANDS,
  RENT_BANDS,
} from "@/data/properties";
import type { Filters, Property } from "@/types";

// 목록·필터 바(칩 시트 결과 수 미리보기)가 공유하는 매물 필터 규칙.
// 가격 구간은 [min, max) — 월세 탭에서는 보증금 × 월세 2축으로 적용된다.
export function filterProperties(
  properties: Property[],
  filters: Filters,
): Property[] {
  const query = filters.query.trim();
  const isMonthlyRent = filters.dealType === "월세";
  const depositBands = isMonthlyRent ? MONTHLY_DEPOSIT_BANDS : PRICE_BANDS;
  const depositBand = depositBands.find((band) => band.value === filters.price);
  const rentBand = isMonthlyRent
    ? RENT_BANDS.find((band) => band.value === filters.rent)
    : undefined;

  return properties.filter((property) => {
    if (
      query &&
      ![property.title, property.region, property.dong].some((value) =>
        value.includes(query),
      )
    ) {
      return false;
    }
    if (filters.dealType !== "all" && property.dealType !== filters.dealType) {
      return false;
    }
    if (filters.region !== "all" && property.region !== filters.region) {
      return false;
    }
    if (
      filters.buildingType !== "all" &&
      property.buildingType !== filters.buildingType
    ) {
      return false;
    }
    if (
      depositBand &&
      (property.deposit < depositBand.min ||
        property.deposit >= depositBand.max)
    ) {
      return false;
    }
    if (
      rentBand &&
      (property.monthlyRent < rentBand.min ||
        property.monthlyRent >= rentBand.max)
    ) {
      return false;
    }
    return true;
  });
}
