// 震度関連のユーティリティ関数

// 震度に応じた色を取得する関数（マップと同じ色スキーム）
export const getIntensityColor = (intensity: string): string => {
  const normalizedIntensity = parseFloat(intensity) || 0;

  if (intensity === "5弱" || intensity === "5-") return "#ffff00";
  if (intensity === "5強" || intensity === "5+") return "#ffcc00";
  if (intensity === "6弱" || intensity === "6-") return "#ff9900";
  if (intensity === "6強" || intensity === "6+") return "#ff6600";

  if (normalizedIntensity === 0) return "#666666";
  if (normalizedIntensity === 1) return "#888888";
  if (normalizedIntensity === 2) return "#00ccff";
  if (normalizedIntensity === 3) return "#00ff99";
  if (normalizedIntensity === 4) return "#66ff33";
  if (normalizedIntensity === 5) return "#ffff00";
  if (normalizedIntensity === 6) return "#ff9900";
  if (normalizedIntensity >= 7) return "#ff0000";
  return "#0066ff";
};

// 黄色系の色で黒文字が必要かどうかを判定
export const needsDarkText = (intensity: string): boolean => {
  const color = getIntensityColor(intensity);
  // 黄色系の色（明るい色）は黒文字を使用
  return color === "#ffff00" || color === "#ffcc00" || color === "#66ff33";
};

// 震度に応じた左ボーダーのTailwindクラスを取得
export const getIntensityBorderClass = (intensity: string): string => {
  const normalizedIntensity = parseFloat(intensity) || 0;

  if (intensity === "5弱" || intensity === "5-") return "border-l-yellow-400";
  if (intensity === "5強" || intensity === "5+") return "border-l-yellow-500";
  if (intensity === "6弱" || intensity === "6-") return "border-l-orange-500";
  if (intensity === "6強" || intensity === "6+") return "border-l-orange-600";

  if (normalizedIntensity === 0) return "border-l-gray-600";
  if (normalizedIntensity === 1) return "border-l-gray-500";
  if (normalizedIntensity === 2) return "border-l-cyan-400";
  if (normalizedIntensity === 3) return "border-l-green-400";
  if (normalizedIntensity === 4) return "border-l-lime-400";
  if (normalizedIntensity === 5) return "border-l-yellow-400";
  if (normalizedIntensity === 6) return "border-l-orange-500";
  if (normalizedIntensity >= 7) return "border-l-red-500";
  return "border-l-gray-500";
};