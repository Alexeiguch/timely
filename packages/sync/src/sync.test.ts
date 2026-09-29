import { expect, it } from "vitest";
import {
  compare,
  tick,
  observe,
  canonicalStamp,
  calibrate,
  mergeGroups,
} from "./index";
const deviceA = "a0000000-0000-4000-8000-000000000000",
  deviceB = "b0000000-0000-4000-8000-000000000000";
const opA = "a0000000-0000-4000-8000-000000000001",
  opB = "b0000000-0000-4000-8000-000000000001";
const old = { physical: 1000, logical: 0, deviceId: deviceA, operationId: opA },
  newer = { ...old, physical: 2000, deviceId: deviceB, operationId: opB };
it("keeps stamps advancing through rollback and restart", () => {
  const first = tick(
    { physical: 2000, logical: 3, offset: 0 },
    1000,
    deviceA,
    opA,
  );
  expect(first.stamp.logical).toBe(4);
  expect(
    compare(tick(first.clock, 500, deviceA, opB).stamp, first.stamp),
  ).toBeGreaterThan(0);
});
it("observes remote stamps before authoring", () => {
  const clock = observe({ physical: 0, logical: 0, offset: 0 }, newer);
  expect(compare(tick(clock, 1000, deviceA, opA).stamp, newer)).toBeGreaterThan(
    0,
  );
});
it("bounds implausible future timestamps and calibrates offset", () => {
  expect(canonicalStamp({ ...old, physical: 9000000 }, 5000).physical).toBe(
    305000,
  );
  expect(
    calibrate({ physical: 0, logical: 0, offset: 0 }, 1000, 1100, 500).offset,
  ).toBe(-550);
});
it("merges independent groups and ignores old arrival on same group", () => {
  const current = {
    groups: {
      state: { value: "completed", stamp: newer },
      priority: { value: "low", stamp: old },
    },
  };
  const remote = {
    groups: {
      state: { value: "pending", stamp: old },
      priority: { value: "high", stamp: newer },
    },
  };
  expect(mergeGroups(current, remote).groups).toEqual({
    state: current.groups.state,
    priority: remote.groups.priority,
  });
});
it("converges with stable tie ordering independent of arrival", () => {
  const a = { groups: { title: { value: "a", stamp: old } } },
    b = {
      groups: {
        title: {
          value: "b",
          stamp: { ...old, deviceId: deviceB, operationId: opB },
        },
      },
    };
  expect(mergeGroups(a, b)).toEqual(mergeGroups(b, a));
});
it("keeps tombstones through ordinary edits and needs explicit newer restore", () => {
  const deleted = { groups: {}, deletion: { value: true, stamp: newer } };
  expect(
    mergeGroups(deleted, {
      groups: {},
      deletion: { value: false, stamp: { ...newer, logical: 1 } },
    }).deletion?.value,
  ).toBe(true);
  expect(
    mergeGroups(
      deleted,
      { groups: {}, deletion: { value: false, stamp: old } },
      "restore",
    ).deletion?.value,
  ).toBe(true);
  expect(
    mergeGroups(
      deleted,
      {
        groups: {},
        deletion: { value: false, stamp: { ...newer, logical: 1 } },
      },
      "restore",
    ).deletion?.value,
  ).toBe(false);
});
