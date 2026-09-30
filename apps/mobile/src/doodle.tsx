import Svg, { Path, Circle, Rect } from "react-native-svg";
import { colors } from "@timely/design";
/** Original small calendar doodle, decorative and bundled offline. */
export function PlannerDoodle() {
  return (
    <Svg width={120} height={100} viewBox="0 0 120 100" accessible={false}>
      <Circle cx="78" cy="40" r="34" fill={colors.lime} />
      <Rect
        x="19"
        y="23"
        width="66"
        height="62"
        rx="15"
        fill={colors.surface}
        stroke={colors.text}
        strokeWidth="2.5"
        transform="rotate(-8 52 54)"
      />
      <Path
        d="M22 43 85 34 M35 17 36 31 M64 13 66 28"
        stroke={colors.text}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <Path
        d="m37 60 9 8 17-22 M96 62l6 3m-7 8 6 5 M8 40l-4-3"
        fill="none"
        stroke={colors.primary}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
