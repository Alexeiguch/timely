import { afterEach, expect, it, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import {
  defaultLanguage,
  errorMessage,
  getLanguage,
  locale,
  messages,
  parseLanguage,
  recurrenceText,
  setLanguage,
  streakText,
  t,
  translate,
  watchLanguageStorage,
} from "./index";
import { ruleSchema } from "@timely/contracts";
afterEach(() => setLanguage("es"));
it("defaults to Spanish regardless of missing, corrupt or unsupported stored language", () => {
  expect(defaultLanguage).toBe("es");
  for (const value of [null, undefined, "fr", "en-US", "{broken", 1])
    expect(parseLanguage(value)).toBe("es");
  expect(parseLanguage("en")).toBe("en");
  expect(locale("es")).toBe("es-ES");
  expect(translate("Settings")).toBe("Ajustes");
  expect(translate("Settings", {}, "en")).toBe("Settings");
});
it("preserves every interpolation slot in Spanish and leaves authored content unchanged", () => {
  const slots = (text: string) =>
    [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  for (const [english, spanish] of Object.entries(messages)) {
    expect(spanish.trim(), english).not.toBe("");
    expect(slots(spanish), english).toEqual(slots(english));
  }
  const title = "Settings {v0} <test>";
  expect(translate("Actions for {v0}", { v0: title })).toBe(
    `Acciones para ${title}`,
  );
  expect(translate("{v0} pending changes", { v0: 1200 })).toContain(
    new Intl.NumberFormat("es-ES").format(1200),
  );
});
it("covers literal UI messages and prevents English-only accessible labels from returning", () => {
  const root = resolve(import.meta.dirname, "../../..");
  const directories = [
    "apps/web/components",
    "apps/web/app",
    "apps/mobile/src",
    "apps/mobile/app",
  ];
  const failures: string[] = [];
  const attrs = new Set([
    "title",
    "label",
    "placeholder",
    "aria-label",
    "accessibilityLabel",
    "confirm",
  ]);
  function scan(dir: string) {
    for (const entry of readdirSync(resolve(root, dir), {
      withFileTypes: true,
    })) {
      const file = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (!file.includes("/api")) scan(file);
        continue;
      }
      if (!file.endsWith(".tsx")) continue;
      const source = ts.createSourceFile(
        file,
        readFileSync(resolve(root, file), "utf8"),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );
      const visit = (node: ts.Node) => {
        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === "t" &&
          node.arguments[0] &&
          ts.isStringLiteral(node.arguments[0])
        ) {
          const key = node.arguments[0].text;
          if (!Object.hasOwn(messages, key))
            failures.push(`${file}: missing ${key}`);
        }
        if (
          ts.isJsxText(node) &&
          /[A-Za-z]{2}/.test(node.text) &&
          !["timely", "English", "Español"].includes(node.text.trim())
        )
          failures.push(`${file}: untranslated text ${node.text.trim()}`);
        if (
          ts.isJsxAttribute(node) &&
          attrs.has(node.name.getText(source)) &&
          node.initializer &&
          ts.isStringLiteral(node.initializer) &&
          /[A-Za-z]{2}/.test(node.initializer.text) &&
          !["English", "Español", "Timely"].includes(node.initializer.text)
        )
          failures.push(`${file}: untranslated label ${node.initializer.text}`);
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
  }
  directories.forEach(scan);
  expect(failures).toEqual([]);
});
it("formats daily, weekly, ordinal monthly and yearly rules without changing schedules", () => {
  const common = {
    anchor: "2026-10-08",
    interval: 1,
    end: { kind: "never" },
    invalidDate: "clamp",
  };
  const weekly = ruleSchema.parse({
    ...common,
    frequency: "weekly",
    interval: 2,
    weekdays: [1, 5],
    firstWeekday: 1,
  });
  const saved = JSON.stringify(weekly);
  expect(recurrenceText(weekly)).toBe("Cada 2 semanas los lunes, viernes");
  expect(
    recurrenceText(ruleSchema.parse({ ...common, frequency: "daily" })),
  ).toBe("Cada día");
  expect(
    recurrenceText(
      ruleSchema.parse({
        ...common,
        frequency: "monthly",
        selector: { kind: "ordinal", ordinal: -1, weekday: "weekday" },
      }),
    ),
  ).toBe("Cada mes, el último día laborable");
  expect(
    recurrenceText(
      ruleSchema.parse({
        ...common,
        frequency: "yearly",
        month: 2,
        selector: { kind: "last-day" },
      }),
    ),
  ).toBe("Cada año, el último día de febrero");
  setLanguage("en");
  expect(recurrenceText(weekly)).toBe("Every 2 weeks on monday, friday");
  expect(JSON.stringify(weekly)).toBe(saved);
});
it("localizes streaks and safe errors in both directions", () => {
  expect(errorMessage("")).toBe("");
  expect(errorMessage(null)).toBe("");
  expect(errorMessage(undefined)).toBe("");
  expect(streakText({ ended: false, count: 3 })).toBe("3 seguidas");
  expect(streakText({ ended: true, count: 0 })).toBe("Racha terminada");
  expect(errorMessage(new Error("Invalid OTP"))).toBe(
    "El código es incorrecto. Inténtalo de nuevo.",
  );
  expect(errorMessage(new Error("private provider payload"))).toBe(
    "Inténtalo de nuevo.",
  );
  setLanguage("en");
  expect(errorMessage("No se pudo guardar.")).toBe("Unable to save.");
});
it("restores a saved choice and persists subsequent offline changes in order", async () => {
  const writes: string[] = [];
  let ready = false;
  const stop = watchLanguageStorage(
    {
      read: () => "en",
      write: async (language) => {
        writes.push(language);
      },
    },
    (state) => {
      ready = state.ready;
    },
  );
  await vi.waitFor(() => expect(ready).toBe(true));
  expect(getLanguage()).toBe("en");
  setLanguage("es");
  setLanguage("en");
  await vi.waitFor(() => expect(writes.slice(-2)).toEqual(["es", "en"]));
  stop();
});
it("keeps a choice made before delayed storage restores, and reports write failures", async () => {
  let finish!: (language: string) => void;
  const write = vi.fn(async () => {
    throw new Error("storage unavailable");
  });
  let status = { ready: false, error: false };
  const stop = watchLanguageStorage(
    {
      read: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
      write,
    },
    (next) => {
      status = next;
    },
  );
  await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
  setLanguage("en");
  finish("es");
  await vi.waitFor(() => expect(status.error).toBe(true));
  expect(getLanguage()).toBe("en");
  stop();
});
