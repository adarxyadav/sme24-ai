const FALLBACK = "/auth/redirect";

// Accepts only a same-origin relative path: exactly one leading "/", no "//",
// no backslash, no scheme, no control characters. Anything else lands on the
// role dispatcher.
export function safeNext(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return FALLBACK;
  if (value.includes("\\") || /[\x00-\x1f\x7f]/.test(value)) return FALLBACK;
  const base = "http://sme24.local";
  try {
    if (new URL(value, base).origin !== base) return FALLBACK;
  } catch {
    return FALLBACK;
  }
  return value;
}
