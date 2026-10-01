import { Button } from "@/components/ui/button";

const HINTS: Record<string, string> = {
  PGRST205: "The database tables weren't found. The database setup script may not have run.",
  "42P01": "The database tables weren't found. The database setup script may not have run.",
  "42501": "The database refused access. Its permission rules may be missing or incomplete.",
  PGRST301: "Your sign-in couldn't be verified by the database. Try logging out and in again.",
  PGRST002: "The database is starting up or unreachable. Try again in a minute.",
  no_startup: "Set up your startup profile first.",
};

/** Shown instead of a page when its data couldn't be loaded. */
export function LoadProblem({ code }: { code: string }) {
  return (
    <div className="mx-auto grid max-w-xl gap-4 px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">We couldn&apos;t load your account</h1>
      <p className="text-muted-foreground">
        {HINTS[code] ?? "Something went wrong while loading your data. Please try again."}
      </p>
      <p className="bg-muted justify-self-start rounded px-2 py-1 font-mono text-sm">Error code: {code}</p>
      <form>
        <Button type="submit" variant="outline">
          Try again
        </Button>
      </form>
    </div>
  );
}
