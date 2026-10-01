import type { Metadata } from "next";
import Link from "next/link";

import { LoadProblem } from "@/components/app/load-problem";
import { getCurrentProfile } from "@/lib/auth/session";
import { load } from "@/lib/data-errors";
import { inbox, markRead } from "@/lib/notifications/service";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Notifications" };

const dateTime = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default async function NotificationsPage() {
  const loaded = await load(async () => {
    const profile = await getCurrentProfile();
    if (!profile) return [];
    const items = await inbox(profile.id, profile.created_at);
    // Opening the page counts as reading them; the list still highlights what was new.
    await markRead(profile.id, items.filter((i) => !i.read).map((i) => i.id));
    return items;
  });
  if (!loaded.ok) return <LoadProblem code={loaded.code} />;
  const items = loaded.data;

  return (
    <div className="grid gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
        <p className="text-muted-foreground mt-1">Messages from the RaiseReady team.</p>
      </div>
      {items.length ? (
        <ul className="grid gap-3">
          {items.map((n) => (
            <li key={n.id} className={cn("bg-card grid gap-2 rounded-xl border p-5", !n.read && "border-primary/50")}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold">
                  {!n.read ? <span className="bg-primary mr-2 inline-block size-2 rounded-full align-middle" aria-label="New" /> : null}
                  {n.title}
                </h2>
                <time dateTime={n.created_at} className="text-muted-foreground text-xs">
                  {dateTime.format(new Date(n.created_at))}
                </time>
              </div>
              <p className="text-sm whitespace-pre-line">{n.body}</p>
              {n.link ? (
                <Link href={n.link} className="text-primary justify-self-start text-sm font-medium underline-offset-4 hover:underline">
                  Open
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">No messages yet. Announcements and updates from the team will appear here.</p>
      )}
    </div>
  );
}
