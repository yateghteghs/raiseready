import { formatMoney } from "@/lib/format";
import type { KnowledgeProfile, SourcedNumber, SourcedText } from "@/lib/ai/schemas/knowledge-profile";

type DocNames = Record<string, string>;
type Source = { source_document_id: string; page_or_sheet: string; quote: string };

const ISO_CURRENCY = /^[A-Z]{3}$/;

export function formatSourcedNumber(n: SourcedNumber): string {
  const value = ISO_CURRENCY.test(n.unit)
    ? formatMoney(n.value, n.unit)
    : n.unit === "%"
      ? `${n.value}%`
      : `${n.value.toLocaleString("en-NG")} ${n.unit}`;
  return n.period ? `${value} (${n.period})` : value;
}

function Citation({ source, docs }: { source: Source; docs: DocNames }) {
  return (
    <details className="text-muted-foreground mt-1 text-xs">
      <summary className="hover:text-foreground cursor-pointer">
        {docs[source.source_document_id] ?? "Document"} · {source.page_or_sheet}
      </summary>
      <blockquote className="border-border mt-1 border-l-2 pl-2 italic">“{source.quote}”</blockquote>
    </details>
  );
}

const MISSING = <span className="text-muted-foreground italic">Not found in your documents</span>;

function TextItem({ label, value, docs }: { label: string; value: SourcedText | null; docs: DocNames }) {
  return (
    <div>
      <dt className="text-sm font-medium">{label}</dt>
      <dd className="mt-1 text-sm">
        {value ? (
          <>
            <p>{value.summary}</p>
            {value.sources.map((s, i) => (
              <Citation key={i} source={s} docs={docs} />
            ))}
          </>
        ) : (
          MISSING
        )}
      </dd>
    </div>
  );
}

function NumberItem({ label, value, docs }: { label: string; value: SourcedNumber | null; docs: DocNames }) {
  return (
    <div>
      <dt className="text-sm font-medium">{label}</dt>
      <dd className="mt-1 text-sm">
        {value ? (
          <>
            <p className="tabular-nums">{formatSourcedNumber(value)}</p>
            <Citation source={value} docs={docs} />
          </>
        ) : (
          MISSING
        )}
      </dd>
    </div>
  );
}

function NumberList({ label, values, docs }: { label: string; values: SourcedNumber[]; docs: DocNames }) {
  return (
    <div>
      <dt className="text-sm font-medium">{label}</dt>
      <dd className="mt-1 grid gap-2 text-sm">
        {values.length === 0
          ? MISSING
          : values.map((v, i) => (
              <div key={i}>
                <p className="tabular-nums">{formatSourcedNumber(v)}</p>
                <Citation source={v} docs={docs} />
              </div>
            ))}
      </dd>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-card rounded-xl border p-5">
      <h3 className="font-semibold">{title}</h3>
      <dl className="mt-4 grid gap-5 sm:grid-cols-2">{children}</dl>
    </section>
  );
}

/** The structured startup profile extracted from the founder's documents. */
export function KnowledgeProfileView({ profile, docs }: { profile: KnowledgeProfile; docs: DocNames }) {
  const p = profile;
  const africa = p.africa_context;
  return (
    <div className="grid gap-4">
      <Group title="The business">
        <TextItem label="Problem" value={p.problem} docs={docs} />
        <TextItem label="Solution" value={p.solution} docs={docs} />
        <TextItem label="Product" value={p.product} docs={docs} />
        <TextItem label="Target customer" value={p.target_customer} docs={docs} />
        <TextItem label="Business model" value={p.business_model} docs={docs} />
        <TextItem label="Pricing" value={p.pricing} docs={docs} />
      </Group>
      <Group title="Market">
        <NumberItem label="Total market (TAM)" value={p.market.tam} docs={docs} />
        <NumberItem label="Serviceable market (SAM)" value={p.market.sam} docs={docs} />
        <NumberItem label="Obtainable market (SOM)" value={p.market.som} docs={docs} />
        <div>
          <dt className="text-sm font-medium">Where the market figures come from</dt>
          <dd className="mt-1 text-sm">{p.market.stated_sources ?? MISSING}</dd>
        </div>
      </Group>
      <Group title="Traction">
        <NumberList label="Revenue" values={p.revenue} docs={docs} />
        <NumberItem label="Users" value={p.traction.users} docs={docs} />
        <NumberItem label="Paying customers" value={p.traction.paying_customers} docs={docs} />
        <NumberList label="Growth" values={p.traction.growth} docs={docs} />
        <TextItem label="Other traction" value={p.traction.notes} docs={docs} />
      </Group>
      <Group title="Unit economics">
        <NumberItem label="Customer acquisition cost (CAC)" value={p.unit_economics.cac} docs={docs} />
        <NumberItem label="Lifetime value (LTV)" value={p.unit_economics.ltv} docs={docs} />
        <NumberItem label="Gross margin" value={p.unit_economics.gross_margin} docs={docs} />
        <NumberItem label="Burn" value={p.unit_economics.burn} docs={docs} />
        <NumberItem label="Runway" value={p.unit_economics.runway} docs={docs} />
      </Group>
      <Group title="Competition and team">
        <TextItem label="Competition" value={p.competition} docs={docs} />
        <TextItem label="Moat" value={p.moat} docs={docs} />
        <TextItem label="Team" value={p.team} docs={docs} />
        <TextItem label="Risks" value={p.risks} docs={docs} />
      </Group>
      <Group title="Fundraising">
        <NumberItem label="Funding ask" value={p.funding_ask} docs={docs} />
        <NumberItem label="Valuation" value={p.valuation} docs={docs} />
        <TextItem label="Use of funds" value={p.use_of_funds} docs={docs} />
      </Group>
      <Group title="African market context">
        <div>
          <dt className="text-sm font-medium">Markets</dt>
          <dd className="mt-1 text-sm">{africa.markets.length ? africa.markets.join(", ") : MISSING}</dd>
        </div>
        <TextItem label="Currency (FX) exposure" value={africa.fx_exposure} docs={docs} />
        <TextItem label="Regulation" value={africa.regulatory_notes} docs={docs} />
        <TextItem label="Informal market dynamics" value={africa.informal_market_dynamics} docs={docs} />
      </Group>
    </div>
  );
}
