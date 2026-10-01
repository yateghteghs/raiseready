import { SignatureForm } from "@/components/admin/signature-form";
import { PageTitle } from "@/components/admin/ui";
import { requireStaff } from "@/lib/admin/auth";
import { getSignatureSettings } from "@/lib/reports/signature";

export const metadata = { title: "Report signature" };

export default async function ReportSignaturePage() {
  await requireStaff("manage_content", "/admin/report-signature");
  const settings = await getSignatureSettings();
  return (
    <>
      <PageTitle
        title="Report signature"
        description="Who signs the PDF readiness reports. Applies to PDFs created from now on; existing PDFs don't change. Founders' company logos are added to their reports automatically."
      />
      <SignatureForm initial={settings} />
    </>
  );
}
