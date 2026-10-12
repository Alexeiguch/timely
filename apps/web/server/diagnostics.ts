/** Log locations and known classifications, never error messages or supplied payloads. */
export class ServerDiagnostics {
  static failure(
    event: string,
    error: unknown,
    context: Record<string, string>,
  ) {
    const value = error instanceof Error ? error : undefined;
    const code =
      error && typeof error === "object" && "code" in error
        ? error.code
        : undefined;
    const names = new Set([
      "Error",
      "TypeError",
      "RangeError",
      "SyntaxError",
      "ZodError",
      "PostgresError",
      "AbortError",
    ]);
    const header = value ? `${value.name}: ${value.message}` : "";
    const frames = value?.stack?.startsWith(header)
      ? value.stack.slice(header.length)
      : "";
    const locations = frames
      .split("\n")
      .slice(1)
      .flatMap((line) => {
        const location = line.match(
          /(?:apps|packages)\/[^\s():]+:\d+:\d+/,
        )?.[0];
        return location ? [location] : [];
      })
      .slice(0, 8);
    console.error(
      JSON.stringify({
        event,
        ...context,
        errorType: value && names.has(value.name) ? value.name : "UnknownError",
        ...(typeof code === "string" &&
        (ServerDiagnostics.unavailable(error) ||
          new Set([
            "23502",
            "23503",
            "23505",
            "23514",
            "40001",
            "40P01",
            "42703",
            "42P01",
            "42501",
          ]).has(code))
          ? { failureCode: code }
          : {}),
        locations: locations ?? [],
      }),
    );
  }
  static unavailable(error: unknown) {
    const code =
      error && typeof error === "object" && "code" in error
        ? error.code
        : undefined;
    return (
      typeof code === "string" &&
      new Set([
        "08000",
        "08001",
        "08003",
        "08004",
        "08006",
        "08007",
        "08P01",
        "53300",
        "57P01",
        "57P02",
        "57P03",
        "ECONNREFUSED",
        "ECONNRESET",
        "ETIMEDOUT",
        "EAI_AGAIN",
      ]).has(code)
    );
  }
}
