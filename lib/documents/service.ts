import { randomUUID } from "node:crypto";

import {
  DOCUMENT_KINDS,
  EXTENSIONS,
  typeFromFileName,
  validateDocument,
  type UploadableKind,
} from "@/lib/documents/rules";
import { MIME_TYPES } from "@/lib/documents/sniff";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export const DOCUMENTS_BUCKET = "documents";
/** Keeps storage bounded; old versions can be deleted to make room. */
export const MAX_DOCUMENTS_PER_STARTUP = 20;

export class DocumentError extends Error {}

/** Documents for a startup, newest first. Runs as the user (RLS applies). */
export async function listDocuments(startupId: string): Promise<Tables<"documents">[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("startup_id", startupId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load documents: ${error.message}`);
  return data;
}

/** The newest knowledge profile for a startup, if any. Runs as the user. */
export async function getLatestKnowledgeProfile(startupId: string): Promise<Tables<"knowledge_profiles"> | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("knowledge_profiles")
    .select("*")
    .eq("startup_id", startupId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Could not load knowledge profile: ${error.message}`);
  return data;
}

function folderFor(userId: string, startupId: string) {
  return `${userId}/${startupId}/`;
}

/**
 * Step 1 of an upload: reserve a private storage path and return a one-time
 * token the browser uses to upload directly to storage. Files never pass
 * through our server on the way in (hosting limits request bodies to ~4.5 MB).
 */
export async function prepareUpload(
  userId: string,
  startupId: string,
  fileName: string,
): Promise<{ path: string; token: string; contentType: string }> {
  const type = typeFromFileName(fileName);
  if (!type) throw new DocumentError("Upload a PDF, Excel (.xlsx) or Word (.docx) file.");

  const existing = await listDocuments(startupId);
  if (existing.length >= MAX_DOCUMENTS_PER_STARTUP) {
    throw new DocumentError(`You can keep up to ${MAX_DOCUMENTS_PER_STARTUP} documents. Delete an old one first.`);
  }

  const path = `${folderFor(userId, startupId)}${randomUUID()}.${EXTENSIONS[type]}`;
  const { data, error } = await createAdminClient().storage.from(DOCUMENTS_BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error(`Could not create upload URL: ${error?.message}`);
  return { path: data.path, token: data.token, contentType: MIME_TYPES[type] };
}

/**
 * Step 2 of an upload: check the stored file's real contents, then record it.
 * Anything that fails the checks is deleted from storage.
 */
export async function finalizeUpload(
  userId: string,
  startupId: string,
  path: string,
  kind: UploadableKind,
  fileName: string,
): Promise<Tables<"documents">> {
  // The path must be inside this user's own startup folder.
  if (!path.startsWith(folderFor(userId, startupId)) || path.includes("..")) {
    throw new DocumentError("Invalid upload.");
  }

  const admin = createAdminClient();
  const storage = admin.storage.from(DOCUMENTS_BUCKET);
  const { data: blob, error: downloadError } = await storage.download(path);
  if (downloadError || !blob) throw new DocumentError("We couldn't find the uploaded file. Please try again.");

  const bytes = Buffer.from(await blob.arrayBuffer());
  const result = validateDocument(bytes, kind);
  if (!result.ok) {
    await storage.remove([path]);
    throw new DocumentError(result.message);
  }

  const { data, error } = await admin
    .from("documents")
    .insert({
      startup_id: startupId,
      kind,
      original_filename: fileName.slice(0, 200),
      storage_path: path,
      mime_type: MIME_TYPES[result.type],
      size_bytes: bytes.length,
      status: "uploaded",
    })
    .select("*")
    .single();
  if (error) {
    await storage.remove([path]);
    throw new Error(`Could not save document: ${error.message}`);
  }
  return data;
}

/** Deletes a document's file and record. Ownership is checked through RLS. */
export async function deleteDocument(documentId: string): Promise<void> {
  const supabase = await createClient();
  const { data: doc, error } = await supabase
    .from("documents")
    .select("id, storage_path, status, updated_at")
    .eq("id", documentId)
    .maybeSingle();
  if (error) throw new Error(`Could not load document: ${error.message}`);
  if (!doc) throw new DocumentError("Document not found.");
  const stillRunning =
    doc.status === "processing" && Date.now() - new Date(doc.updated_at).getTime() < 15 * 60 * 1000;
  if (stillRunning) throw new DocumentError("Wait for the analysis to finish before deleting this file.");

  const { error: storageError } = await createAdminClient().storage.from(DOCUMENTS_BUCKET).remove([doc.storage_path]);
  if (storageError) throw new Error(`Could not delete file: ${storageError.message}`);

  const { error: deleteError } = await supabase.from("documents").delete().eq("id", doc.id);
  if (deleteError) throw new Error(`Could not delete document: ${deleteError.message}`);
}

/** A link to view a document that expires after a minute. Runs as the user. */
export async function documentLink(documentId: string): Promise<string> {
  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("documents")
    .select("storage_path, original_filename")
    .eq("id", documentId)
    .maybeSingle();
  if (!doc) throw new DocumentError("Document not found.");
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(doc.storage_path, 60, { download: doc.original_filename ?? true });
  if (error || !data) throw new Error(`Could not create link: ${error?.message}`);
  return data.signedUrl;
}

export { DOCUMENT_KINDS };
