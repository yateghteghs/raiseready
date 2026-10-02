"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { PlanLimitError } from "@/lib/billing/limits";
import { buildDeck, DeckError, deleteDeck, editSlide, rewriteSlide, slideEditSchema, unlockDeck } from "@/lib/decks/service";
import { formValues, validationFailed, type FormState } from "@/lib/forms";
import { getMyStartup } from "@/lib/startups/service";

const SIGNED_OUT: FormState = { status: "error", message: "Your session has ended. Please log in again." };
const UPGRADE = { href: "/app/billing", label: "See plans and prices" };

function failure(error: unknown, where: string): FormState {
  if (error instanceof PlanLimitError) return { status: "error", message: error.message, action: UPGRADE };
  if (error instanceof DeckError) return { status: "error", message: error.message };
  console.error(`[decks] ${where} failed:`, error);
  return { status: "error", message: "Something went wrong. Please try again." };
}

const ids = (deckId: string, index?: number) =>
  z.uuid().safeParse(deckId).success && (index === undefined || (Number.isInteger(index) && index >= 0 && index < 20));

export async function buildDeckAction(): Promise<FormState> {
  let id: string;
  try {
    const user = await getCurrentUser();
    if (!user) return SIGNED_OUT;
    const startup = await getMyStartup();
    if (!startup) return { status: "error", message: "Set up your startup profile first." };
    id = await buildDeck(user.id, startup);
  } catch (error) {
    return failure(error, "build");
  }
  redirect(`/app/decks/${id}`);
}

export async function unlockDeckAction(deckId: string): Promise<FormState> {
  if (!ids(deckId)) return { status: "error", message: "That deck doesn't exist." };
  try {
    const user = await getCurrentUser();
    if (!user) return SIGNED_OUT;
    await unlockDeck(user.id, deckId);
  } catch (error) {
    return failure(error, "unlock");
  }
  revalidatePath(`/app/decks/${deckId}`);
  return { status: "success", message: "Unlocked. Every slide is yours to edit and download." };
}

export async function editSlideAction(deckId: string, index: number, _prev: FormState, formData: FormData): Promise<FormState> {
  if (!ids(deckId, index)) return { status: "error", message: "That slide isn't available." };
  const values = formValues(formData);
  const parsed = slideEditSchema.safeParse(values);
  if (!parsed.success) return validationFailed(parsed.error, values);
  try {
    const user = await getCurrentUser();
    if (!user) return SIGNED_OUT;
    await editSlide(user.id, deckId, index, parsed.data);
  } catch (error) {
    return { ...failure(error, "edit"), values };
  }
  revalidatePath(`/app/decks/${deckId}`);
  return { status: "success", message: "Saved." };
}

export async function rewriteSlideAction(deckId: string, index: number, _prev: FormState, formData: FormData): Promise<FormState> {
  if (!ids(deckId, index)) return { status: "error", message: "That slide isn't available." };
  const request = String(formData.get("request") ?? "");
  if (!request.trim()) return { status: "error", message: "Say how the slide should change.", fieldErrors: { request: ["Say how the slide should change."] } };
  if (request.length > 500) return { status: "error", message: "Keep your request under 500 characters.", values: { request } };
  try {
    const user = await getCurrentUser();
    if (!user) return SIGNED_OUT;
    await rewriteSlide(user.id, deckId, index, request);
  } catch (error) {
    return { ...failure(error, "rewrite"), values: { request } };
  }
  revalidatePath(`/app/decks/${deckId}`);
  return { status: "success", message: "Rewritten. Check the new wording and edit anything that isn't right." };
}

export async function deleteDeckAction(deckId: string): Promise<{ error?: string } | void> {
  if (!ids(deckId)) return { error: "That deck doesn't exist." };
  try {
    const user = await getCurrentUser();
    if (!user) return { error: "Your session has ended. Please log in again." };
    await deleteDeck(user.id, deckId);
  } catch (error) {
    const state = failure(error, "delete");
    return { error: state.message };
  }
  redirect("/app/decks");
}
