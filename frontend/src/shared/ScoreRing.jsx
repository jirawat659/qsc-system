import React from "react";
import { c, mono } from "../config/theme";

export default function ScoreRing({ score, size = 36, strokeWidth, isPassed, hasCritical }) {
  let color = "#0F6659";
  let bgClass = "bg-emerald-50/30";

  const numScore = Number(score) || 0;

  if (hasCritical) {
    color = "#DC2626";
    bgClass = "bg-rose-50/40";
  } else if (isPassed === false) {
    color = "#D97706";
    bgClass = "bg-amber-50/40";
  } else {
    color = numScore >= 85 ? "#0F6659" : numScore >= 70 ? "#D97706" : "#DC2626";
    bgClass = numScore >= 85 ? "bg-emerald-50/30" : numScore >= 70 ? "bg-amber-50/30" : "bg-rose-50/30";
  }

  const calculatedStroke = strokeWidth || (size >= 80 ? 6 : size >= 60 ? 4.5 : size >= 44 ? 3.5 : 2.5);
  // 🌟 ปรับคะแนนเป็นทศนิยมไม่เกิน 2 ตำแหน่ง โดยถ้าเลขท้ายสุดเป็น 0 จะไม่แสดง (เช่น 92.40 -> 92.4, 92.00 -> 92)
  const displayScore = isNaN(Number(score)) 
    ? score 
    : parseFloat(Number(score).toFixed(2));
  const strScore = String(displayScore);
  const calculatedFontSize = size >= 80 
    ? (strScore.length > 4 ? 19 : 22) 
    : size >= 60 
    ? (strScore.length > 4 ? 14 : 16) 
    : size >= 44 
    ? (strScore.length > 4 ? 10.5 : 12) 
    : size < 36 
    ? (strScore.length > 4 ? 8 : 9) 
    : (strScore.length > 4 ? 9.5 : 11);

  return (
    <div
      className={`rounded-full flex items-center justify-center font-black shrink-0 transition-transform shadow-2xs px-0.5 ${bgClass}`}
      style={{
        width: size,
        height: size,
        border: `${calculatedStroke}px solid ${color}`,
        color,
        fontFamily: mono,
        fontSize: calculatedFontSize,
      }}
    >
      {displayScore}
    </div>
  );
}
