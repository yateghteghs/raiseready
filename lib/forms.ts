import { z } from "zod";

/** Field-level errors keyed by form field name. */
export type FieldErrors = Partial<Record<string, string[]>>;

export type FormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: FieldErrors;
  /** Submitted values, echoed back so the form keeps them after an error. */
  values?: Record<string, string>;
  /** Optional link shown with the message, e.g. to upgrade. */
  action?: { href: string; label: string };
};

export const initialFormState: FormState = { status: "idle" };

/** Plain string values from a FormData, ignoring files. */
export function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$ACTION")) values[key] = value;
  }
  return values;
}

export function fieldErrorsOf(error: z.ZodError): FieldErrors {
  return z.flattenError(error).fieldErrors as FieldErrors;
}

export function validationFailed(error: z.ZodError, values: Record<string, string>): FormState {
  return {
    status: "error",
    message: "Please fix the highlighted fields.",
    fieldErrors: fieldErrorsOf(error),
    values,
  };
}
