"use client";

import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { leaveTeamAction } from "@/lib/teams/actions";

export function LeaveTeamButton({ name }: { name: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (window.confirm(`Leave ${name}? You'll lose the Pro Plus it gives you, and its programme team will no longer see your progress.`)) {
          start(() => leaveTeamAction());
        }
      }}
    >
      Leave team
    </Button>
  );
}
