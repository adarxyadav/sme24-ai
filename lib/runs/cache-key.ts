// Stage-1 research cache key (pipeline-rules.md, Caching). The trigger route and
// the stage-1 task both call this, so a cache hit depends on one rule and not on
// two implementations agreeing.

type CacheKeyInput = {
  companyName: string;
  companyDomain?: string | null;
};

// NFC first: the same company typed on macOS and on Windows decomposes
// differently, and two byte-different keys silently miss cache — a paid
// Parallel call that should have been a hit.
function normalizeText(value: string): string {
  return value.normalize("NFC").trim().toLowerCase().replace(/\s+/g, " ");
}

// Parsed with URL rather than a regex so scheme, credentials, port, path, query
// and fragment all fall away by construction. A bare host has no scheme, so it
// is parsed against a placeholder one.
function normalizeDomain(value: string): string | null {
  const compact = normalizeText(value).replace(/\s+/g, "");
  if (!compact) return null;

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//.test(compact)
    ? compact
    : `https://${compact}`;

  let host: string;
  try {
    host = new URL(withScheme).hostname;
  } catch {
    return null;
  }

  const trimmed = host.replace(/\.$/, "").replace(/^www\./, "");
  return trimmed || null;
}

// Domain when one was supplied and parses, else the company name.
export function cacheKey({ companyName, companyDomain }: CacheKeyInput): string {
  if (companyDomain) {
    const domain = normalizeDomain(companyDomain);
    if (domain) return domain;
  }
  return normalizeText(companyName);
}
