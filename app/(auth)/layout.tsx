import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { PoweredBy } from "@/components/brand/powered-by";
import { LanguagePicker } from "@/components/layout/language-picker";
import { getMessages } from "@/lib/i18n/server";

export default async function AuthLayout({ children }: LayoutProps<"/">) {
  const { locale, m } = await getMessages();
  return (
    <div className="bg-muted/40 flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
        <Link href="/" aria-label={m.common.home} className="inline-block">
          <Logo />
        </Link>
        <LanguagePicker locale={locale} label={m.common.changeLanguage} />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-6 pb-8 sm:pt-12">{children}</main>
      <footer className="flex justify-center px-4 pb-10">
        <PoweredBy label={m.footer.poweredBy} />
      </footer>
    </div>
  );
}
