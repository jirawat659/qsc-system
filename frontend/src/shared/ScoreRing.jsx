import React from "react";
import { c, mono } from "../config/theme";

export default function ScoreRing({ score, size = 36, strokeWidth }) {
  const color = score >= 85 ? "#0F6659" : score >= 70 ? "#D97706" : "#DC2626";
  const calculatedStroke = strokeWidth || (size >= 80 ? 6 : size >= 60 ? 4.5 : size >= 44 ? 3.5 : 2.5);
  const calculatedFontSize = size >= 80 ? 24 : size >= 60 ? 18 : size >= 44 ? 14 : size < 32 ? 10 : 12;

  return (
    <div
      className="rounded-full flex items-center justify-center font-black shrink-0 transition-transform shadow-2xs bg-emerald-50/30"
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
