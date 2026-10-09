import { expect, it } from "vitest";
import {
  resistedOffset,
  settleIndex,
  velocityFrom,
} from "../apps/web/components/phrase-motion";

const span = 188;

it("follows the finger inside the deck and resists both ends", () => {
  expect(resistedOffset(-span, -span * 3, span)).toBe(-span);
  const start = resistedOffset(80, -span * 3, span);
  const further = resistedOffset(320, -span * 3, span);
  expect(start).toBeGreaterThan(0);
  expect(start).toBeLessThan(80);
  expect(further).toBeGreaterThan(start);
  expect(further).toBeLessThan(span);
  const end = resistedOffset(-span * 3 - 80, -span * 3, span);
  const harder = resistedOffset(-span * 3 - 320, -span * 3, span);
  expect(end).toBeLessThan(-span * 3);
  expect(end).toBeGreaterThan(-span * 4);
  expect(harder).toBeLessThan(end);
  expect(harder).toBeGreaterThan(-span * 4);
});

it("advances one card from a committed drag and snaps back from a short one", () => {
  const base = {
    index: 1,
    count: 4,
    originOffset: -span,
    span,
    axis: "x" as const,
  };
  expect(
    settleIndex({ ...base, offset: -span - 20, velocity: 0 }),
  ).toBe(1);
  expect(
    settleIndex({ ...base, offset: -span - span * 0.2, velocity: 0 }),
  ).toBe(2);
  expect(
    settleIndex({ ...base, offset: -span + span * 0.2, velocity: 0 }),
  ).toBe(0);
});

it("lets a flick override travel, including a change of mind, and stops at the ends", () => {
  expect(
    settleIndex({
      index: 0,
      count: 4,
      offset: -30,
      originOffset: 0,
      span,
      velocity: -0.8,
      axis: "x",
    }),
  ).toBe(1);
  expect(
    settleIndex({
      index: 1,
      count: 4,
      offset: -span - span * 0.4,
      originOffset: -span,
      span,
      velocity: 0.9,
      axis: "x",
    }),
  ).toBe(0);
  expect(
    settleIndex({
      index: 0,
      count: 4,
      offset: 40,
      originOffset: 0,
      span,
      velocity: 1.2,
      axis: "x",
    }),
  ).toBe(0);
  expect(
    settleIndex({
      index: 3,
      count: 4,
      offset: -span * 3 - 40,
      originOffset: -span * 3,
      span,
      velocity: -1.2,
      axis: "x",
    }),
  ).toBe(3);
});

it("settles a vertical release or a tap to the nearest card", () => {
  expect(
    settleIndex({
      index: 2,
      count: 4,
      offset: -span * 1.6,
      originOffset: -span * 2,
      span,
      velocity: -2,
      axis: "y",
    }),
  ).toBe(2);
  expect(
    settleIndex({
      index: 0,
      count: 4,
      offset: -span * 0.6,
      originOffset: 0,
      span,
      velocity: 0,
      axis: null,
    }),
  ).toBe(1);
});

it("reads flick speed from the last tenth of a second and ignores a pause", () => {
  expect(
    velocityFrom([
      { x: 0, t: 0 },
      { x: -40, t: 40 },
      { x: -90, t: 80 },
    ]),
  ).toBeCloseTo(-90 / 80);
  expect(
    velocityFrom([
      { x: 0, t: 0 },
      { x: -200, t: 40 },
      { x: -200, t: 180 },
    ]),
  ).toBe(0);
  expect(velocityFrom([{ x: 10, t: 0 }])).toBe(0);
});
