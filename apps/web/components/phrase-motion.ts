export type PointSample = { x: number; t: number };

/** The card follows the drag. Pulling past either end resists and stays short of one card. */
export function cardOffset(
  dx: number,
  index: number,
  count: number,
  span: number,
): number {
  if (span <= 0 || count <= 1) return 0;
  if (index <= 0 && dx > 0) return rubber(dx, span);
  if (index >= count - 1 && dx < 0) return rubber(dx, span);
  return dx;
}

function rubber(delta: number, span: number): number {
  const abs = Math.abs(delta);
  const resisted = (abs * span * 0.55) / (span + 0.55 * abs);
  return Math.sign(delta) * resisted;
}

export function velocityFrom(samples: readonly PointSample[]): number {
  if (samples.length < 2) return 0;
  const last = samples[samples.length - 1]!;
  const cutoff = last.t - 100;
  let first = last;
  for (const sample of samples) {
    if (sample.t >= cutoff) {
      first = sample;
      break;
    }
  }
  const dt = last.t - first.t;
  if (dt < 16) return 0;
  return (last.x - first.x) / dt;
}

const flickSpeed = 0.45;

export function settleIndex(input: {
  index: number;
  count: number;
  offset: number;
  originOffset: number;
  span: number;
  velocity: number;
  axis: "x" | "y" | null;
}): number {
  const { index, count, offset, originOffset, span, velocity, axis } = input;
  const clamp = (value: number) => Math.max(0, Math.min(count - 1, value));
  if (count <= 1 || span <= 0) return clamp(index);
  if (axis !== "x") return clamp(Math.round(-offset / span));
  const delta = offset - originOffset;
  const flick = Math.abs(velocity) > flickSpeed;
  let target = index;
  if ((flick && velocity < 0) || (!flick && delta < -span * 0.18)) target += 1;
  else if ((flick && velocity > 0) || (!flick && delta > span * 0.18))
    target -= 1;
  return clamp(target);
}
