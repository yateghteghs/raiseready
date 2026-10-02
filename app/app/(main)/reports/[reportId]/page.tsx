import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LoadProblem } from "@/components/app/load-problem";
import { DownloadReportButton } from "@/components/reports/download-button";
import { ReportView } from "@/components/reports/report-view";
import { ShareReport } from "@/components/reports/share-report";
import { load } from "@/lib/data-errors";
import { reportContentSchema } from "@/lib/reports/content";
import { listShares } from "@/lib/reports/shares";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Readiness report" };

/** The PDF is created on demand if it is missing. */
export const maxDuration = 120;

export default async function ReportPage({ params }: PageProps<"/app/reports/[reportId]">) {
  const { reportId } = await params;
  const loaded = await load(async () => {
    const supabase = await createClient();
    const { data } = await supabase.from("reports").select("*").eq("id", reportId).maybeSingle();
    return data ? { report: data, shares: await listShares(data.id) } : null;
  });
  if (!loaded.ok) return <LoadProblem code={loaded.code} />;
  if (!loaded.data) notFound();
  const parsed = reportContentSchema.safeParse(loaded.data.report.content);
  if (!parsed.success) return <LoadProblem code="report_format" />;

  return (
    <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-8">
      <ReportView content={parsed.data} actions={<DownloadReportButton reportId={loaded.data.report.id} />} />
      <ShareReport reportId={loaded.data.report.id} shares={loaded.data.shares} />
    </div>
  );
}
