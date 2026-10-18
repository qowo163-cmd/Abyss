const integer = new Intl.NumberFormat("ko-KR");
const compact = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 });

/** GP 원본 숫자를 보존하면서 거래소 표시만 읽기 쉬운 한국어 단위로 축약한다. */
export function formatGpAmount(value: number): string {
  if (!Number.isFinite(value)) return "0 GP";
  if (value >= 100_000_000) return `${compact.format(value / 100_000_000)}억 GP`;
  if (value >= 10_000_000) return `${compact.format(value / 10_000_000)}천만 GP`;
  return `${integer.format(value)} GP`;
}

/** 자동사냥박스 등록 화면의 억 단위 수량을 원본 GP 정수값으로 변환한다. */
export function gpFromEokCount(value: number): number {
  return value * 100_000_000;
}
