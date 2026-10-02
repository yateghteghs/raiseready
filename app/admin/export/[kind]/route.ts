import { getStaff } from "@/lib/admin/auth";
import { exportCsv, EXPORT_KINDS, type ExportKind } from "@/lib/admin/export";
import { can } from "@/lib/admin/permissions";

/** CSV download of an admin list (admin and super admin only). Read-only, so no origin check is needed. */
export async function GET(_request: Request, ctx: RouteContext<"/admin/export/[kind]">) {
  const { kind } = await ctx.params;
  const staff = await getStaff();
  if (!staff || !can(staff.profile.role, "export") || !EXPORT_KINDS.includes(kind as ExportKind)) {
    return new Response("Not found", { status: 404 });
  }
  const { csv, filename } = await exportCsv(staff, kind as ExportKind);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
