// Stage 3's arithmetic, shared by the engine (which stores the figures) and
// the read layer (which re-derives them from the same stored peers so figure
// and chart cannot disagree — pipeline-rules.md, Stage 3). Pure: no client,
// no AI. The comparison type lives here because both tiers read it.

export type RateMetric = "TRIR" | "LTIFR";

export type BenchmarkPeer = {
  company_name: string;
  country: string | null;
  trir: number | null;
  trir_basis: string | null;
  ltifr: number | null;
  ltifr_basis: string | null;
  reporting_year: string | null;
  scope: "employees" | "combined" | null;
  source_url: string | null;
  source_excerpt: string | null;
  confidence: "low" | "medium" | "high";
  // The judgment's comparability call (same metric, same base, a real figure
  // for the company's own sector); code re-checks the base below.
  comparable: boolean;
};

export type BenchmarkReference = {
  metric: RateMetric;
  basis: string | null;
  median: number | null;
  best_in_class: number | null;
  source_url: string | null;
  source_excerpt: string | null;
};

export type CompanyRate = { value: number; unit: string | null };

export type BenchmarkComparison = {
  schema_version: 1;
  rate_metric: RateMetric | null;
  company: Record<RateMetric, CompanyRate | null>;
  peers: BenchmarkPeer[];
  // Only ever on rate_metric's metric and base (comparability rules).
  references: BenchmarkReference | null;
  industry: { nace_code: string | null; nace_label: string | null; notes: string | null };
};

// kpi-contract.md: TRIR and LTIFR are per 1'000'000 hours worked here; a
// figure on any other base is stored as disclosed and never ranked. The
// basis is free text as disclosed, so this is a recogniser, not a parser.
export function isPerMillionHours(basis: string | null): boolean {
  if (!basis) return false;
  const text = basis.toLowerCase();
  const million = /1[,'’.\s]?000[,'’.\s]?000|million|mio\b|1e6|10\^6|10⁶/.test(text);
  return million && /hour|hrs|h\b|heures|stunden/.test(text);
}

function peerRate(peer: BenchmarkPeer, metric: RateMetric): number | null {
  const value = metric === "TRIR" ? peer.trir : peer.ltifr;
  const basis = metric === "TRIR" ? peer.trir_basis : peer.ltifr_basis;
  return value !== null && isPerMillionHours(basis) ? value : null;
}

// The rates the rank is computed over: comparable peers with a figure on the
// company's base. Same function at write and read time.
export function comparablePeerRates(comparison: BenchmarkComparison): number[] {
  const metric = comparison.rate_metric;
  if (!metric) return [];
  return comparison.peers.flatMap((peer) => {
    if (!peer.comparable) return [];
    const rate = peerRate(peer, metric);
    return rate === null ? [] : [rate];
  });
}

// Rank 1 = lowest rate = safest; the company is placed among the peers, so
// "n of N" reads as n-th of N peers plus itself. Null rank when the company
// has no figure on the base or there is nobody to rank against.
export function deriveRank(comparison: BenchmarkComparison): {
  rank: number | null;
  peerCount: number;
} {
  const rates = comparablePeerRates(comparison);
  const metric = comparison.rate_metric;
  const company = metric ? comparison.company[metric] : null;
  if (!metric || !company || !isPerMillionHours(company.unit) || rates.length === 0) {
    return { rank: null, peerCount: rates.length };
  }
  return {
    rank: 1 + rates.filter((rate) => rate < company.value).length,
    peerCount: rates.length,
  };
}
