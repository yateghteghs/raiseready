import { requireUser } from "@/lib/auth/session";

/** Everything under /app requires a verified signed-in user. */
export default async function AppLayout({ children }: LayoutProps<"/app">) {
  await requireUser();
  return <div className="flex flex-1 flex-col">{children}</div>;
}
