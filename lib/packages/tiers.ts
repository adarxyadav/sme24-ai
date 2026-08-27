// The four packages, mirroring context/product/packages.md (the tier source of
// truth). Copy here is the table's; the Open questions there (tier 3 scope,
// final names) are left as the doc states them. Prices in CHF, MWST excluded.

export type TierId = "snapshot" | "system_culture" | "transformation" | "implementation";

export type Tier = {
  id: TierId;
  number: 1 | 2 | 3 | 4;
  name: string;
  bestFor: string;
  format: string;
  coreValue: string;
  scope: string;
  output: string;
  outcome: string;
  // Null = priced on request (tier 4: contact form, no checkout).
  priceChf: number | null;
};

export const TIERS: readonly Tier[] = [
  {
    id: "snapshot",
    number: 1,
    name: "EHS Snapshot",
    bestFor: "Quick visibility",
    format: "Remote · 1 day",
    coreValue: "Know where you stand",
    scope: "8 top categories at 5 safety-culture levels",
    output: "Top 5 risks",
    outcome: "Visibility in 48 hours",
    priceChf: 2_000,
  },
  {
    id: "system_culture",
    number: 2,
    name: "EHS System & Culture Snapshot",
    bestFor: "Validate real risks",
    format: "On-site · 2 days",
    coreValue: "Know your real risks",
    scope: "8 top categories at 5 safety-culture levels + ISO 45001",
    output: "Top 20 risks",
    outcome: "Audit-ready reality",
    priceChf: 5_000,
  },
  {
    id: "transformation",
    number: 3,
    name: "EHS Transformation Plan",
    bestFor: "Fix systematically",
    format: "On-site · 5 days",
    coreValue: "Know what to fix and how",
    scope: "Tier 2 scope plus selected standards (final wording pending — packages.md, Open)",
    output: "Gap plan & timeline",
    outcome: "Clear action plan",
    priceChf: 10_000,
  },
  {
    id: "implementation",
    number: 4,
    name: "EHS Implementation Partner",
    bestFor: "Deliver results",
    format: "On-site + ongoing",
    coreValue: "Risks eliminated",
    scope: "Implementation, PMO, coaching",
    output: "Measured risk reduction",
    outcome: "Execution & culture shift",
    priceChf: null,
  },
] as const;

export const TIER_IDS = TIERS.map((tier) => tier.id) as [TierId, ...TierId[]];

export function tierById(id: TierId): Tier {
  const tier = TIERS.find((t) => t.id === id);
  if (!tier) throw new Error(`unknown tier ${id}`);
  return tier;
}
