"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

/**
 * Header buttons on public pages. Signed-in visitors get a way back to their
 * dashboard; everyone else sees log in / sign up. The page stays static: the
 * session is read in the browser after load.
 */
export function AuthActions() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let active = true;
    try {
      const supabase = createClient();
      supabase.auth.getSession().then(({ data }) => {
        if (active) setSignedIn(Boolean(data.session));
      });
    } catch {
      // Supabase not configured: stay in the signed-out state.
    }
    return () => {
      active = false;
    };
  }, []);

  if (signedIn) {
    return (
      <Button asChild size="sm">
        <Link href="/app">Go to dashboard</Link>
      </Button>
    );
  }
  return (
    <>
      <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
        <Link href="/login">Log in</Link>
      </Button>
      <Button asChild size="sm">
        <Link href="/register">Get started</Link>
      </Button>
    </>
  );
}
