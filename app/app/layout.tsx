import { requireUser } from "@/lib/auth/session";

/** Everything under /app requires a verified signed-in user. */
export default async function AppLayout({ children }: LayoutProps<"/app">) {
  await requireUser();
  // The app isn't translated yet: keep it in English, left to right.
  return (
    <div lang="en" dir="ltr" className="flex flex-1 flex-col">
      {children}
    </div>
  );
}
