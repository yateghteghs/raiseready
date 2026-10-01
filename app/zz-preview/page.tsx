import { AnalysePanel } from "@/components/documents/analyse-panel";
import { DocumentList } from "@/components/documents/document-list";
import { KnowledgeProfileView } from "@/components/documents/knowledge-profile-view";
import { UploadSlot } from "@/components/documents/upload-slot";
import { DOCUMENT_KINDS } from "@/lib/documents/rules";

const src = { source_document_id: "d1", page_or_sheet: "page 2", quote: "1,200 paying merchants" };
const profile = {
  problem: { summary: "Market traders in Lagos can't easily accept digital payments.", sources: [src] },
  solution: null, product: null, target_customer: null,
  market: { tam: null, sam: null, som: null, stated_sources: null },
  business_model: null, pricing: null,
  revenue: [{ value: 4500000, unit: "NGN", period: "March 2026", ...src }],
  traction: { users: null, paying_customers: { value: 1200, unit: "merchants", period: null, ...src }, growth: [{ value: 15, unit: "%", period: "month on month", ...src }], notes: null },
  unit_economics: { cac: null, ltv: null, gross_margin: null, burn: { value: 1800000, unit: "NGN", period: "monthly", source_document_id: "d2", page_or_sheet: "sheet Costs & Burn, row 3", quote: "Burn,1800000" }, runway: null },
  competition: null, moat: null, team: null,
  funding_ask: { value: 500000, unit: "USD", period: null, ...src },
  use_of_funds: null, valuation: null, risks: null,
  africa_context: { markets: ["Nigeria", "Ghana"], fx_exposure: null, regulatory_notes: null, informal_market_dynamics: null },
};

export default function Preview() {
  return (
    <main className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-8">
      <div className="grid gap-4 md:grid-cols-3">
        {(["pitch_deck", "financial_model", "business_plan"] as const).map((k, i) => (
          <UploadSlot key={k} kind={k} label={DOCUMENT_KINDS[k].label} hint={DOCUMENT_KINDS[k].hint} accept="" required={DOCUMENT_KINDS[k].required} disabled={false} current={i === 0 ? { name: "PayLink-deck-v3.pdf", when: "1 Oct 2026" } : null} />
        ))}
      </div>
      <AnalysePanel canStart running={false} hasProfile failure={null} />
      <DocumentList rows={[
        { id: "d1", name: "PayLink-deck-v3.pdf", kindLabel: "Pitch deck", size: "2.4 MB", when: "1 Oct 2026", status: "ready", error: null, inUse: true },
        { id: "d2", name: "model.xlsx", kindLabel: "Financial model", size: "48 KB", when: "1 Oct 2026", status: "failed", error: "The AI service had a problem. Please try again.", inUse: true },
      ]} />
      <KnowledgeProfileView profile={profile} docs={{ d1: "Pitch deck", d2: "Financial model" }} />
    </main>
  );
}
