export const c = {
  bg: "#F6F6F3",
  surface: "#FFFFFF",
  ink: "#1C2129",
  muted: "#6B7280",
  faint: "#9CA3AF",
  border: "#E5E3DA",
  accent: "#0F6659",
  accentSoft: "#E3F0ED",
  risk: "#B3452C",
  riskSoft: "#F6E7E2",
  warn: "#9A7B0A",
  warnSoft: "#F5EFDD",
};

export const sans = "'Prompt', 'IBM Plex Sans Thai', -apple-system, BlinkMacSystemFont, sans-serif";
export const mono = "'IBM Plex Mono', monospace";
export const cardStyle = { background: c.surface, border: `1px solid ${c.border}` };

// 🌟 QSC Standard Typography Scale Classes
export const typography = {
  pageTitle: "text-lg sm:text-xl font-bold text-slate-900 leading-tight tracking-tight",
  pageSubtitle: "text-xs font-normal text-slate-500 mt-0.5",
  cardTitle: "text-sm sm:text-base font-bold text-slate-800 leading-snug",
  sectionTitle: "text-xs sm:text-sm font-extrabold text-slate-700 tracking-wide",
  body: "text-xs sm:text-sm font-normal text-slate-700 leading-relaxed",
  caption: "text-[11px] sm:text-xs font-medium text-slate-500",
  badge: "text-[11px] sm:text-xs font-bold leading-none",
  kpiNumber: "text-2xl sm:text-3xl font-extrabold font-mono tracking-tight",
  input: "text-xs sm:text-sm font-medium",
  label: "text-xs sm:text-sm font-bold text-slate-700 mb-1.5"
};
