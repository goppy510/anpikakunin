// 日時関連のユーティリティ関数

// 日本時間フォーマット関数
export function formatJPDateTime(dateStr: string) {
  const d = new Date(dateStr);
  return `${(d.getMonth() + 1).toString().padStart(2, "0")}/${d
    .getDate()
    .toString()
    .padStart(2, "0")} ${d.getHours().toString().padStart(2, "0")}:${d
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
}

// 深さ表示のヘルパー関数
export function renderDepth(
  depth?: { value?: number; condition?: string } | null
): string {
  if (!depth) return "-";
  if (depth.condition) return depth.condition;
  if (depth.value !== undefined) return `${depth.value}km`;
  return "不明";
}

// マグニチュードの値を小数点第1位まで表示する関数
export function renderMagnitude(magnitude?: { value?: string | number }): string {
  if (!magnitude?.value) return "-";
  
  const value = magnitude.value;
  
  // 数値に変換
  const numericValue = typeof value === "string" ? parseFloat(value) : value;
  
  if (isNaN(numericValue)) return "-";
  
  // 小数点第1位まで表示
  return numericValue.toFixed(1);
}