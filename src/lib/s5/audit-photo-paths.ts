const CURRENT_PATH = /^\d{4}-\d{2}-\d{2}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/i;
const PREVIOUS_PATH = /^\d{4}-\d{2}-\d{2}\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/i;
const LEGACY_PATH = /^\d{10,17}-[a-z0-9]{5,16}\.jpg$/i;

/** Extracts only valid s5-photos object paths from an audit's nested JSON. */
export function collectAuditPhotoPaths(value: unknown): string[] {
  const paths = new Set<string>();

  function visit(item: unknown): void {
    if (typeof item === "string") {
      const path = extractPath(item);
      if (path) paths.add(path);
      return;
    }
    if (Array.isArray(item)) return void item.forEach(visit);
    if (item && typeof item === "object") Object.values(item).forEach(visit);
  }

  visit(value);
  return [...paths];
}

function extractPath(value: string): string | null {
  let candidate = value;
  try {
    const url = new URL(value, "https://local.invalid");
    candidate = url.searchParams.get("path") ?? value.split("/s5-photos/")[1] ?? value;
  } catch {
    // A bare object path is expected for older audits.
  }
  try { candidate = decodeURIComponent(candidate); } catch { return null; }
  return CURRENT_PATH.test(candidate) || PREVIOUS_PATH.test(candidate) || LEGACY_PATH.test(candidate)
    ? candidate
    : null;
}
