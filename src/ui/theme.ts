import { Platform } from "react-native";

export const colors = {
  bg: "#070B14",
  surface: "#0F172A",
  surfaceRaised: "#131C31",
  sunken: "#050912",
  border: "#1E293B",
  borderStrong: "#334155",
  text: "#F8FAFC",
  textSecondary: "#CBD5E1",
  textMuted: "#94A3B8",
  textSubtle: "#64748B",
  brand: "#38BDF8",
  success: "#22C55E",
  warning: "#F59E0B",
  danger: "#F87171",
  overlay: "rgba(4,8,18,0.86)",
} as const;

/** Per-game accent colours, shared by the home list, entry screens and in-game UI. */
export const gameAccents = {
  memematch: "#38BDF8",
  mafia: "#F43F5E",
  imposter: "#F59E0B",
  chicago: "#A78BFA",
  musicQuiz: "#22C55E",
  trivia: "#F97316",
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 26,
  pill: 999,
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const type = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: "900" as const },
  title: { fontSize: 24, lineHeight: 30, fontWeight: "900" as const },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: "800" as const },
  body: { fontSize: 16, lineHeight: 24, fontWeight: "400" as const },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: "700" as const },
  small: { fontSize: 14, lineHeight: 20, fontWeight: "400" as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "800" as const, letterSpacing: 0.6 },
} as const;

/** Minimum comfortable touch target on phones. */
export const touch = { min: 48, primary: 56 } as const;

/** Content column width; phones use the full width, bigger screens stay readable. */
export const contentMaxWidth = 520;

/** Strips the browser focus ring / sizing quirks from web TextInputs. */
export const webInputReset = Platform.OS === "web" ? ({ outlineStyle: "none", boxSizing: "border-box" } as object) : {};

/** Returns `hex` with the given alpha, e.g. withAlpha("#38BDF8", 0.2). */
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
}
