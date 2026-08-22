import { FileSearch, ListChecks, BarChart3, Users, FileText, type LucideIcon } from "lucide-react";

type Step = { icon: LucideIcon; title: string; body: string };

// The five pipeline stages (pipeline-rules.md) in the client's words. Order
// is the contract's; nothing here promises a timing the engine does not keep.
const STEPS: Step[] = [
  { icon: FileSearch, title: "We research your disclosures", body: "Sustainability reports, annual reports, ESG tables — whatever your company has published about safety." },
  { icon: ListChecks, title: "We extract the KPIs, with sources", body: "TRIR, LTIFR, fatalities, near misses, hours worked. Every figure cites the page it came from; nothing is estimated." },
  { icon: BarChart3, title: "We benchmark you against peers", body: "Same sector, same metric, same basis. A rank, the sector references and a plain-language verdict." },
  { icon: Users, title: "We match senior EHS experts", body: "Swiss consultants from our network, ranked by fit with your risk profile — and told why." },
  { icon: FileText, title: "You get a proposal PDF", body: "A concrete roadmap and the package that fits, grounded in ISO 45001, SUVA and EKAS practice." },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-it-works-title" className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">How it works</p>
        <h2 id="how-it-works-title" className="text-2xl font-medium tracking-tight">Five steps, one company name</h2>
      </div>
      <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          return (
            <li key={step.title} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground tabular-nums">{index + 1}</span>
                <Icon aria-hidden="true" className="size-5 text-primary" />
              </div>
              <h3 className="font-medium">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.body}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
