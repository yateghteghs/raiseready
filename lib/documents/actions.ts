"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { isUploadableKind } from "@/lib/documents/rules";
import {
  deleteDocument,
  DocumentError,
  documentLink,
  finalizeUpload,
  listDocuments,
  prepareUpload,
} from "@/lib/documents/service";
import { beginExtraction, runExtraction } from "@/lib/extraction/pipeline";
import { getMyStartup } from "@/lib/startups/service";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const GENERIC_ERROR = "Something went wrong. Please try again.";

/** Resolves the signed-in founder and their startup, or explains what's missing. */
async function context() {
  const user = await getCurrentUser();
  if (!user) throw new DocumentError("Your session has ended. Please log in again.");
  const startup = await getMyStartup();
  if (!startup) throw new DocumentError("Set up your startup profile first.");
  return { user, startup };
}

async function run<T>(label: string, fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (error instanceof DocumentError) return { ok: false, error: error.message };
    console.error(`[documents] ${label} failed:`, error);
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function prepareUploadAction(fileName: string) {
  return run("prepare upload", async () => {
    const { user, startup } = await context();
    return prepareUpload(user.id, startup.id, String(fileName));
  });
}

export async function finalizeUploadAction(path: string, kind: string, fileName: string) {
  return run("finalize upload", async () => {
    if (!isUploadableKind(kind)) throw new DocumentError("Choose what kind of document this is.");
    const { user, startup } = await context();
    await finalizeUpload(user.id, startup.id, String(path), kind, String(fileName));
    revalidatePath("/app/documents");
    return undefined;
  });
}

export async function deleteDocumentAction(documentId: string) {
  return run("delete", async () => {
    await context();
    await deleteDocument(String(documentId));
    revalidatePath("/app/documents");
    return undefined;
  });
}

export async function documentLinkAction(documentId: string) {
  return run("link", async () => {
    await context();
    return documentLink(String(documentId));
  });
}

/** Starts analysing the newest documents. The work continues after the response. */
export async function startExtractionAction() {
  return run("start extraction", async () => {
    const { user, startup } = await context();
    const ids = await beginExtraction(user.id, await listDocuments(startup.id));
    after(() => runExtraction(user.id, startup.id, ids));
    revalidatePath("/app/documents");
    return undefined;
  });
}
