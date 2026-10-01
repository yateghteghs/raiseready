"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getStaff } from "@/lib/admin/auth";
import { can } from "@/lib/admin/permissions";
import { formValues, validationFailed, type FormState } from "@/lib/forms";
import { notificationSchema } from "@/lib/notifications/schema";
import { deleteNotification, NotificationError, sendNotification } from "@/lib/notifications/service";

export async function sendNotificationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await getStaff();
  if (!staff || !can(staff.profile.role, "notify")) return { status: "error", message: "Your role can't send notifications." };
  const values = formValues(formData);
  const parsed = notificationSchema.safeParse(values);
  if (!parsed.success) return validationFailed(parsed.error, values);
  try {
    const { recipient } = await sendNotification(staff, parsed.data);
    revalidatePath("/admin/notifications");
    return { status: "success", message: `Sent to ${recipient}.` };
  } catch (error) {
    if (error instanceof NotificationError) return { status: "error", message: error.message, values };
    console.error("[notifications] send failed:", error);
    return { status: "error", message: "Something went wrong. The message wasn't sent.", values };
  }
}

export async function deleteNotificationAction(id: string): Promise<void> {
  const staff = await getStaff();
  if (!staff || !can(staff.profile.role, "notify") || !z.uuid().safeParse(id).success) return;
  await deleteNotification(staff, id);
  revalidatePath("/admin/notifications");
}
