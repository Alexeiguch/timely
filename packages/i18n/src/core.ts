import spanish from "./es.json";
export type Language = "es" | "en";
export const defaultLanguage: Language = "es";
export const languageStorageKey = "timely-language";
export const messages: Readonly<Record<string, string>> = spanish;
export function parseLanguage(value: unknown): Language {
  return value === "en" ? "en" : "es";
}
let language: Language = defaultLanguage;
const listeners = new Set<() => void>();
export const getLanguage = () => language;
export const subscribeLanguage = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export function setLanguage(value: Language) {
  if (value !== "en" && value !== "es") return;
  if (value === language) return;
  language = value;
  for (const listener of listeners) listener();
}
export const locale = (value = getLanguage()) =>
  value === "es" ? "es-ES" : "en-GB";
export type Parameters = Record<string, string | number | null | undefined>;
export function translate(
  message: string,
  parameters: Parameters = {},
  selected: Language = defaultLanguage,
): string {
  const template = selected === "es" ? (messages[message] ?? message) : message;
  return template.replace(/\{(\w+)\}/g, (token, name: string) =>
    Object.hasOwn(parameters, name)
      ? typeof parameters[name] === "number"
        ? new Intl.NumberFormat(locale(selected)).format(
            parameters[name] as number,
          )
        : String(parameters[name] ?? "")
      : token,
  );
}
export const t = (message: string, parameters?: Parameters) =>
  translate(message, parameters, getLanguage());
/** Convert known domain/provider errors without exposing raw technical errors. */
export function errorMessage(
  error: unknown,
  fallback = "Please try again.",
): string {
  if (error == null || error === "") return "";
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  if (Object.hasOwn(messages, message)) return t(message);
  const original = Object.keys(messages).find(
    (key) => messages[key] === message,
  );
  if (original) return t(original);
  if (/invalid.*otp|invalid.*code|incorrect.*code/i.test(message))
    return t("The code is incorrect. Please try again.");
  if (/expired.*otp|expired.*code|otp.*expired/i.test(message))
    return t("This code has expired. Request a new one.");
  if (/too many|rate.?limit/i.test(message))
    return t("Too many attempts. Please wait and try again.");
  if (/network|fetch|offline|connection/i.test(message))
    return t("Connection unavailable. Your saved plans are safe.");
  if (/invalid.*email/i.test(message)) return t("Enter a valid email address.");
  return t(fallback);
}
