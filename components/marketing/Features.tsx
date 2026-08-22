import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Feature = { title: string; body: string };

// What the report contains — the dashboard's five cards, described.
const FEATURES: Feature[] = [
  { title: "KPI ledger with sources", body: "Seven canonical safety KPIs, each with its period, confidence and the cited disclosure. Your own figures always win and are marked as yours." },
  { title: "Annual incident cost in CHF", body: "What last year's incidents cost, priced per incident from the ISO 45004 loss table — a range, never an invented point estimate." },
  { title: "Peer benchmark", body: "Your rank among peers disclosing the same metric on the same basis, the sector median and best in class, and a maturity reading." },
  { title: "Matched experts", body: "The three consultants from our network who fit your risk profile best, with a rationale written for you." },
  { title: "Proposal PDF", body: "A consulting proposal with a roadmap and the recommended package, ready to forward to your board." },
];

export function Features() {
  return (
    <section id="what-you-get" aria-labelledby="what-you-get-title" className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">What you get</p>
        <h2 id="what-you-get-title" className="text-2xl font-medium tracking-tight">The free report</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => (
          <Card key={feature.title}>
            <CardHeader>
              <CardTitle className="text-lg">{feature.title}</CardTitle>
              <CardDescription>{feature.body}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </section>
  );
}
