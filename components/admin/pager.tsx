import Link from "next/link";

import { Button } from "@/components/ui/button";

/** Previous / next links for an admin list; keeps the other query parameters. */
export function Pager({
  page,
  total,
  pageSize,
  path,
  params = {},
}: {
  page: number;
  total: number;
  pageSize: number;
  path: string;
  params?: Record<string, string>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const href = (p: number) => `${path}?${new URLSearchParams({ ...params, page: String(p) }).toString()}`;
  return (
    <nav aria-label="Pages" className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">
        Page {page} of {pages} · {total.toLocaleString("en-NG")} in total
      </span>
      <span className="flex gap-2">
        {page > 1 ? (
          <Button asChild size="sm" variant="outline">
            <Link href={href(page - 1)}>Previous</Link>
          </Button>
        ) : null}
        {page < pages ? (
          <Button asChild size="sm" variant="outline">
            <Link href={href(page + 1)}>Next</Link>
          </Button>
        ) : null}
      </span>
    </nav>
  );
}

/** Page number from a search parameter, at least 1. */
export function pageParam(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n > 0 ? Math.min(n, 10_000) : 1;
}
