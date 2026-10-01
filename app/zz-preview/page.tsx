import { Room } from "@/components/simulation/room";
export default function Preview() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <Room simulationId="x" investorName="Seed VC" plan={[1, 2]} roundTitles={{ 1: "Overview", 2: "Problem" }} maxInvestorTurns={20} maxAnswerChars={4000} mode="live" docLabels={{ deck: "Pitch deck" }}
        initialTurns={[
          { id: "t0", turn_index: 0, round: 1, role: "investor", content: "Hello there." },
          { id: "t1", turn_index: 1, round: 1, role: "founder", content: "We have about 3,000 paying merchants." },
          { id: "t2", turn_index: 2, round: 1, role: "investor", content: "Which number is right?" },
        ]}
        initialFlags={[{ id: "f1", turn_id: "t1", type: "contradiction", severity: "high", description: "You said about 3,000 paying merchants, but your deck says 1,200.", evidence: [{ source: "document", document_id: "deck", page_or_sheet: "page 2", turn_index: null, quote: "1,200 paying merchants" }] }]} />
    </main>
  );
}
