import { cn } from "@/lib/utils";

export function PageHero({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="border-b">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        {eyebrow ? <p className="text-primary text-sm font-medium">{eyebrow}</p> : null}
        <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
          {title}
        </h1>
        {children ? <div className="text-muted-foreground mt-4 max-w-2xl text-lg">{children}</div> : null}
      </div>
    </section>
  );
}

export function Section({
  id,
  title,
  intro,
  children,
  className,
}: {
  id?: string;
  title?: string;
  intro?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20", className)}>
      {title ? <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2> : null}
      {intro ? <p className="text-muted-foreground mt-3 max-w-2xl">{intro}</p> : null}
      <div className={title || intro ? "mt-10" : undefined}>{children}</div>
    </section>
  );
}
