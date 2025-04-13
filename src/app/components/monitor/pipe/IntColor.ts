import type { Components } from "@dmdata/api-types";

/**
 * 震度クラスを色番号文字列に変換
 * 例: "5-" → "51", "6+" → "62", "3" → "3"
 */
export function intColor(
  value: Components.Earthquake.IntensityClass | null | undefined
): string {
  if (!value) return "0";

  if (value[1] === "-") return `${value[0]}1`;
  if (value[1] === "+") return `${value[0]}2`;

  return value;
}
