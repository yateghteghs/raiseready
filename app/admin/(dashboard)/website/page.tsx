import Link from "next/link";

import { ShowcaseForm } from "@/components/admin/showcase-form";
import { ShowcaseItemActions } from "@/components/admin/showcase-item-actions";
import { PageTitle } from "@/components/admin/ui";
import { requireStaff } from "@/lib/admin/auth";
import { SHOWCASE_KINDS } from "@/lib/showcase/schema";
import { allShowcase } from "@/lib/showcase/service";

export const metadata = { title: "Website" };

export default async function WebsiteContentPage() {
  await requireStaff("manage_content", "/admin/website");
  const items = await allShowcase();
  return (
    <>
      <PageTitle
        title="Website"
        description="Startup logos, testimonials and partners on the public site. Only show companies and people who have agreed to it."
      />
      <p className="text-muted-foreground -mt-4 text-sm">
        Shown on the{" "}
        <Link href="/" className="underline underline-offset-4">
          home page
        </Link>
        ,{" "}
        <Link href="/testimonials" className="underline underline-offset-4">
          Testimonials
        </Link>{" "}
        and{" "}
        <Link href="/partners" className="underline underline-offset-4">
          Partners
        </Link>
        . Sections stay hidden until something is published.
      </p>
      <ShowcaseForm />
      {SHOWCASE_KINDS.map((k) => {
        const ofKind = items.filter((i) => i.kind === k.value);
        return (
          <section key={k.value} className="grid gap-3">
            <h2 className="font-semibold">
              {k.label}s <span className="text-muted-foreground font-normal">({ofKind.length})</span>
            </h2>
            {ofKind.length ? (
              <ul className="divide-y rounded-xl border">
                {ofKind.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center gap-4 p-4">
                    <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white">
                      {i.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- public storage image
                        <img src={i.imageUrl} alt="" className="size-full object-contain p-1" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {i.name}{" "}
                        <span className={i.published ? "text-primary text-xs" : "text-muted-foreground text-xs"}>
                          {i.published ? "Published" : "Draft"}
                        </span>
                      </p>
                      {i.quote ? <p className="text-muted-foreground line-clamp-2 text-sm">&ldquo;{i.quote}&rdquo; — {i.person_name}</p> : null}
                      <p className="text-muted-foreground text-xs">Order {i.position}{i.permission_confirmed ? "" : " · permission not confirmed"}</p>
                    </div>
                    <ShowcaseItemActions id={i.id} published={i.published} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">None yet.</p>
            )}
          </section>
        );
      })}
    </>
  );
}
