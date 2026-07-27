// 중개업등록번호 형식: 시군구코드(5자리)-연도(4자리)-일련번호(5자리) 예) 11680-2026-00123
const REGISTRATION_NUMBER_PATTERN = /^\d{5}-\d{4}-\d{5}$/;

export function isValidRegistrationNumber(value: string) {
  return REGISTRATION_NUMBER_PATTERN.test(value.trim());
}
