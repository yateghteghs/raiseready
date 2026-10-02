import { DownloadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Link to a CSV export. Shown only to roles that may export. */
export function ExportButton({ kind }: { kind: "users" | "simulations" | "payments" }) {
  return (
    <Button asChild variant="outline" size="sm">
      {/* A plain link: the browser downloads the file. */}
      <a href={`/admin/export/${kind}`} download>
        <DownloadIcon aria-hidden="true" /> Export CSV
      </a>
    </Button>
  );
}
