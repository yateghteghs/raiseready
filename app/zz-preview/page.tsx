import { AppHeader } from "@/components/app/app-header";
import { ProgressChart } from "@/components/progress/progress-chart";
const d = (s: string) => new Date(s).getTime();
export default function Preview() {
  return (
    <>
      <AppHeader email="ada@example.com" nav={["Dashboard", "Startup", "Documents", "Assessment", "Investor Room", "Reports", "Progress"].map((l) => ({ href: "/" + l, label: l }))} />
      <main className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-6 px-4 py-8">
        <section className="bg-card rounded-xl border p-5">
          <ProgressChart
            readiness={[{ t: d("2026-09-02"), score: 41 }, { t: d("2026-09-12"), score: 52 }, { t: d("2026-09-22"), score: 63 }, { t: d("2026-10-01"), score: 71 }]}
            meetings={[{ t: d("2026-09-14"), score: 48 }, { t: d("2026-09-25"), score: 61 }, { t: d("2026-09-30"), score: 66 }]}
          />
        </section>
      </main>
    </>
  );
}
