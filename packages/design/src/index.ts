export const colors = {
  primary: "#1A5FCF",
  secondary: "#12459A",
  lime: "#E9FF72",
  orange: "#FFBC80",
  background: "#FAF9F1",
  surface: "#FFFFFF",
  text: "#14294D",
  muted: "#667389",
} as const;
export const radius = {
  small: 12,
  medium: 18,
  card: 24,
  container: 32,
  pill: 999,
} as const;
export const spacing = [4, 8, 12, 16, 24, 32, 48, 64] as const;
export const typography = { heading: "Baloo 2", body: "Nunito Sans" } as const;
export const copy = {
  appName: "Timely",
  tagline: "A little space for what matters.",
  nav: ["Planner", "Review", "Search", "Settings"],
  priorities: { low: "Low", medium: "Medium", high: "High" },
} as const;

// Derived light surfaces; the eight brand colors above remain unchanged.
export const surfaces = {
  border: "#E2E6DE",
  inputBorder: "#A9B3C2",
  neutral: "#F0EFE5",
  blue: "#EDF3FE",
  orange: "#FFF0E2",
  danger: "#9F3525",
} as const;
export const nativeTypography = {
  heading: { fontFamily: "Baloo2", fontSize: 32, lineHeight: 40 },
  section: { fontFamily: "Baloo2", fontSize: 24, lineHeight: 32 },
  title: { fontFamily: "NunitoSansBold", fontSize: 18, lineHeight: 25 },
  body: { fontFamily: "NunitoSans", fontSize: 16, lineHeight: 23 },
  caption: { fontFamily: "NunitoSans", fontSize: 14, lineHeight: 20 },
  label: { fontFamily: "NunitoSansBold", fontSize: 14, lineHeight: 20 },
} as const;
