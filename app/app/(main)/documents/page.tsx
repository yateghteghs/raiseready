import type { Metadata } from "next";

import { LoadProblem } from "@/components/app/load-problem";
import { AnalysePanel } from "@/components/documents/analyse-panel";
import { DocumentList, type DocumentRow } from "@/components/documents/document-list";
import { KnowledgeProfileView } from "@/components/documents/knowledge-profile-view";
import { UploadSlot } from "@/components/documents/upload-slot";
import { knowledgeProfileSchema } from "@/lib/ai/schemas/knowledge-profile";
import { load } from "@/lib/data-errors";
import { DOCUMENT_KINDS, type UploadableKind } from "@/lib/documents/rules";
import { getLatestKnowledgeProfile, listDocuments } from "@/lib/documents/service";
import { isRunning, selectDocumentsForExtraction } from "@/lib/extraction/pipeline";
import { getMyStartup } from "@/lib/startups/service";

export const metadata: Metadata = { title: "Documents" };

/** Analysis runs in the background after the action that starts it; allow it time. */
export const maxDuration = 300;

const dateFormat = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric" });

function formatSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function DocumentsPage() {
  const loaded = await load(async () => {
    const startup = await getMyStartup();
    if (!startup) return null;
    const [docs, profile] = await Promise.all([listDocuments(startup.id), getLatestKnowledgeProfile(startup.id)]);
    return { docs, profile };
  });
  if (!loaded.ok) return <LoadProblem code={loaded.code} />;
  if (!loaded.data) return <LoadProblem code="no_startup" />;

  const { docs, profile } = loaded.data;
  const inUse = new Set(selectDocumentsForExtraction(docs).map((d) => d.id));
  const running = isRunning(docs);
  const newestOfKind = (kind: UploadableKind) => docs.find((d) => d.kind === kind) ?? null;
  const failed = docs.find((d) => inUse.has(d.id) && d.status === "failed");
  const parsedProfile = profile ? knowledgeProfileSchema.safeParse(profile.data) : null;
  const docNames = Object.fromEntries(
    docs.map((d) => [d.id, `${DOCUMENT_KINDS[d.kind as UploadableKind]?.label ?? "Document"}`]),
  );

  const rows: DocumentRow[] = docs.map((d) => ({
    id: d.id,
    name: d.original_filename ?? "Untitled",
    kindLabel: DOCUMENT_KINDS[d.kind as UploadableKind]?.label ?? "Other",
    size: formatSize(d.size_bytes),
    when: dateFormat.format(new Date(d.created_at)),
    status: d.status,
    error: d.error_message,
    inUse: inUse.has(d.id),
  }));

  return (
    <div className="grid gap-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
        <p className="text-muted-foreground mt-1">
          Upload your pitch deck, plus your financial model and business plan if you have them. Files are stored
          privately and only used to assess your startup.
        </p>
      </div>

      <section aria-labelledby="upload-heading" className="grid gap-4">
        <h2 id="upload-heading" className="sr-only">
          Upload
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {(Object.keys(DOCUMENT_KINDS) as UploadableKind[]).map((kind) => {
            const rules = DOCUMENT_KINDS[kind];
            const current = newestOfKind(kind);
            return (
              <UploadSlot
                key={kind}
                kind={kind}
                label={rules.label}
                hint={rules.hint}
                accept={rules.acceptAttr}
                required={rules.required}
                disabled={running}
                current={
                  current
                    ? { name: current.original_filename ?? "Untitled", when: dateFormat.format(new Date(current.created_at)) }
                    : null
                }
              />
            );
          })}
        </div>
        <AnalysePanel
          canStart={Boolean(newestOfKind("pitch_deck"))}
          running={running}
          hasProfile={Boolean(profile)}
          failure={!running && failed ? (failed.error_message ?? "The last analysis failed.") : null}
        />
      </section>

      <section aria-labelledby="files-heading" className="grid gap-4">
        <h2 id="files-heading" className="text-lg font-semibold">
          Your files
        </h2>
        <DocumentList rows={rows} />
      </section>

      <section aria-labelledby="profile-heading" className="grid gap-4">
        <div>
          <h2 id="profile-heading" className="text-lg font-semibold">
            What we found in your documents
          </h2>
          <p className="text-muted-foreground text-sm">
            {profile
              ? `Version ${profile.version}, analysed ${dateFormat.format(new Date(profile.created_at))}. Open a source to see the exact quote.`
              : "Analyse your documents to see the facts an investor would pick up from them."}
          </p>
        </div>
        {parsedProfile?.success ? (
          <KnowledgeProfileView profile={parsedProfile.data} docs={docNames} />
        ) : profile ? (
          <p className="text-muted-foreground text-sm">This profile was made with an older format. Re-analyse to refresh it.</p>
        ) : null}
      </section>
    </div>
  );
}
