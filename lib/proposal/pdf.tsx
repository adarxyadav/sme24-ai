import "server-only";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { tierById } from "@/lib/packages/tiers";
import type { ProposalContent } from "@/lib/proposal/schema";

// The proposal PDF (t-019-spec.md D4). Pure rendering of stored content: the
// ledger rows and the vault sources come from the rows, the prose from the
// model's content jsonb. Built-in Helvetica — no font files to bundle.

const chf = new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 0 });

const styles = StyleSheet.create({
  page: { padding: 48, fontFamily: "Helvetica", fontSize: 10.5, lineHeight: 1.45, color: "#1f1d1a" },
  brand: { fontSize: 9, color: "#6b6762", marginBottom: 18, letterSpacing: 1 },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  subtitle: { fontSize: 11, color: "#6b6762", marginBottom: 18 },
  h2: { fontSize: 13, fontFamily: "Helvetica-Bold", marginTop: 16, marginBottom: 6 },
  p: { marginBottom: 6 },
  bullet: { flexDirection: "row", marginBottom: 3 },
  bulletDot: { width: 12 },
  bulletText: { flex: 1 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#d9d4cc", paddingVertical: 3 },
  cellMetric: { flex: 2 },
  cellValue: { flex: 1, textAlign: "right" },
  cellMeta: { flex: 2, color: "#6b6762", paddingLeft: 8 },
  box: { borderWidth: 0.5, borderColor: "#d9d4cc", padding: 10, marginTop: 8 },
  small: { fontSize: 8.5, color: "#6b6762" },
  footer: { position: "absolute", bottom: 24, left: 48, right: 48, fontSize: 8, color: "#6b6762" },
});

export type PdfKpi = { label: string; value: string; unit: string | null; period: string | null; origin: string };
export type PdfSource = { title: string; source: string | null };

export type ProposalPdfInput = {
  companyName: string;
  generatedOn: string;
  content: ProposalContent;
  kpis: PdfKpi[];
  sources: PdfSource[];
};

function Bullets({ items }: { items: string[] }) {
  return (
    <View>
      {items.map((item, index) => (
        <View key={index} style={styles.bullet}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function ProposalDocument({ companyName, generatedOn, content, kpis, sources }: ProposalPdfInput) {
  const tier = tierById(content.recommended_tier);
  return (
    <Document title={content.title} author="SME24" subject={`EHS proposal for ${companyName}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>SME24 · EHS CONSULTING PROPOSAL</Text>
        <Text style={styles.title}>{content.title}</Text>
        <Text style={styles.subtitle}>
          Prepared for {companyName} · {generatedOn}
        </Text>

        <Text style={styles.h2}>Executive summary</Text>
        <Text style={styles.p}>{content.executive_summary}</Text>

        <Text style={styles.h2}>What the analysis found</Text>
        <Bullets items={content.situation} />

        {kpis.length > 0 && (
          <>
            <Text style={styles.h2}>Safety KPIs on record</Text>
            {kpis.map((kpi) => (
              <View key={kpi.label} style={styles.row}>
                <Text style={styles.cellMetric}>{kpi.label}</Text>
                <Text style={styles.cellValue}>{kpi.value}</Text>
                <Text style={styles.cellMeta}>
                  {[kpi.unit, kpi.period, kpi.origin === "client" ? "client-provided" : null].filter(Boolean).join(" · ")}
                </Text>
              </View>
            ))}
          </>
        )}

        <Text style={styles.h2}>Key risks</Text>
        {content.key_risks.map((risk, index) => (
          <View key={index} style={styles.p}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{risk.risk}</Text>
            <Text>{risk.why_it_matters}</Text>
          </View>
        ))}

        <Text style={styles.h2}>Recommended package</Text>
        <View style={styles.box}>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>
            {tier.number} — {tier.name} · {tier.priceChf === null ? "priced on request" : `${chf.format(tier.priceChf)} excl. MWST`}
          </Text>
          <Text style={styles.small}>
            {tier.format} · {tier.scope} · Output: {tier.output}
          </Text>
          <Text style={{ marginTop: 6 }}>{content.recommendation_rationale}</Text>
        </View>

        <Text style={styles.h2}>Roadmap</Text>
        {content.roadmap.map((phase, index) => (
          <View key={index} style={styles.p}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{phase.phase}</Text>
            <Bullets items={phase.actions} />
          </View>
        ))}

        <Text style={styles.h2}>Who would lead the work</Text>
        <Text style={styles.p}>{content.experts_note}</Text>

        {sources.length > 0 && (
          <>
            <Text style={styles.h2}>Reference material</Text>
            {sources.map((source, index) => (
              <Text key={index} style={styles.small}>
                {source.title}
                {source.source ? ` — ${source.source}` : ""}
              </Text>
            ))}
          </>
        )}

        <Text style={styles.footer} fixed>
          SME24 · Figures are copied from cited disclosures or supplied by the client; nothing is estimated. Prices exclude Swiss MWST.
        </Text>
      </Page>
    </Document>
  );
}

export function renderProposalPdf(input: ProposalPdfInput): Promise<Buffer> {
  return renderToBuffer(<ProposalDocument {...input} />);
}
