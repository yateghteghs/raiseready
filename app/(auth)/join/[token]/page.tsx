import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { JoinTeamForm } from "@/components/teams/join-form";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { teamForJoinToken } from "@/lib/teams/service";

export const metadata: Metadata = { title: "Join your programme", robots: { index: false } };

const dateFormat = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "long", year: "numeric" });

export default async function JoinTeamPage({ params }: PageProps<"/join/[token]">) {
  const { token } = await params;
  const [team, user] = await Promise.all([teamForJoinToken(token), getCurrentUser()]);

  let body: React.ReactNode;
  if (!team) {
    body = <p className="text-sm">This join link isn&apos;t valid any more. Ask your programme for a new one.</p>;
  } else if (team.ended) {
    body = <p className="text-sm">{team.name}&apos;s RaiseReady access has ended.</p>;
  } else if (team.full) {
    body = <p className="text-sm">{team.name} has no seats left. Ask your programme to add more.</p>;
  } else if (!user) {
    body = (
      <div className="grid gap-3 text-sm">
        <p>Log in or create a free account first, then open this link again to join.</p>
        <Button asChild className="w-full">
          <Link href={`/login?next=${encodeURIComponent(`/join/${token}`)}`}>Log in to join</Link>
        </Button>
        <Button asChild variant="outline" className="w-full">
          <Link href="/register">Create an account</Link>
        </Button>
      </div>
    );
  } else {
    body = (
      <div className="grid gap-4 text-sm">
        <ul className="grid list-disc gap-1 ps-5">
          <li>You get RaiseReady Pro Plus, paid for by {team.name}, until {dateFormat.format(new Date(team.endsAt))}.</li>
          <li>
            {team.name}&apos;s programme team can see your progress: your name, startup name, readiness score, how many practice
            meetings you&apos;ve completed and when you were last active.
          </li>
          <li>They can&apos;t see your documents, your answers or your reports.</li>
          <li>You can leave the team at any time under Settings.</li>
        </ul>
        <JoinTeamForm token={token} name={team.name} />
      </div>
    );
  }

  return (
    <div lang="en" dir="ltr" className="flex w-full justify-center">
      <AuthCard title={team ? `Join ${team.name} on RaiseReady` : "Join your programme"} description="Practise your pitch with your cohort.">
        {body}
      </AuthCard>
    </div>
  );
}
