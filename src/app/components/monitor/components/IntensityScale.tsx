/* 震度スケール凡例コンポーネント */
"use client";

import { useEffect, useState } from "react";

export function IntensityScale() {
  const [isClient, setIsClient] = useState(false);

  // クライアントサイドであることを確認
  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) return null;

  const intensityLevels = [
    { intensity: 7, color: "#ff0000", label: "震度7" },
    { intensity: 6.5, color: "#ff6600", label: "震度6強" },
    { intensity: 6, color: "#ff9900", label: "震度6弱" },
    { intensity: 5.5, color: "#ffcc00", label: "震度5強" },
    { intensity: 5, color: "#ffff00", label: "震度5弱" },
    { intensity: 4, color: "#66ff33", label: "震度4" },
    { intensity: 3, color: "#00ff99", label: "震度3" },
    { intensity: 2, color: "#00ccff", label: "震度2" },
    { intensity: 1, color: "#0080ff", label: "震度1" },
    { intensity: 0, color: "#0066ff", label: "震度0" },
  ];

  return (
    <div
      style={{
        position: "absolute",
        bottom: "20px",
        right: "10px",
        background: "rgba(0,0,0,0.8)",
        color: "white",
        padding: "10px",
        borderRadius: "5px",
        fontSize: "11px",
        zIndex: 1000,
        minWidth: "120px"
      }}
    >
      <div style={{ fontWeight: "bold", marginBottom: "5px", textAlign: "center" }}>
        震度スケール
      </div>
      {intensityLevels.map(({ intensity, color, label }) => (
        <div
          key={intensity}
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: "2px",
          }}
        >
          <div
            style={{
              width: "12px",
              height: "12px",
              backgroundColor: color,
              borderRadius: "50%",
              marginRight: "8px",
            }}
          />
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}