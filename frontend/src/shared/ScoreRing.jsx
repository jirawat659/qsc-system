import React from "react";
import { c, mono } from "../config/theme";

export default function ScoreRing({ score, size = 36, strokeWidth, isPassed, hasCritical }) {
  let color = "#0F6659";
  let bgClass = "bg-emerald-50/30";

  if (hasCritical) {
    color = "#DC2626";
    bgClass = "bg-rose-50/40";
  } else if (isPassed === false) {
    color = "#D97706";
    bgClass = "bg-amber-50/40";
  } else {
    color = score >= 85 ? "#0F6659" : score >= 70 ? "#D97706" : "#DC2626";
    bgClass = score >= 85 ? "bg-emerald-50/30" : score >= 70 ? "bg-amber-50/30" : "bg-rose-50/30";
  }

  const calculatedStroke = strokeWidth || (size >= 80 ? 6 : size >= 60 ? 4.5 : size >= 44 ? 3.5 : 2.5);
  const calculatedFontSize = size >= 80 ? 24 : size >= 60 ? 18 : size >= 44 ? 14 : size < 32 ? 10 : 12;

  return (
    <div
      className={`rounded-full flex items-center justify-center font-black shrink-0 transition-transform shadow-2xs ${bgClass}`}
      style={{
        width: size,
        height: size,
        border: `${calculatedStroke}px solid ${color}`,
        color,
        fontFamily: mono,
        fontSize: calculatedFontSize,
      }}
    >
      {score}
    </div>
  );
}
