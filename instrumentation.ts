import type { Instrumentation } from "next";

/**
 * Records server errors for the admin Errors page. The digest stored here is
 * the "Reference" founders see on the error screen, so staff can look it up.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { recordError } = await import("@/lib/activity/service");
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const digest = typeof error === "object" && error !== null && "digest" in error ? String(error.digest) : null;
  await recordError({ source: "server", message, digest, path: request.path, routeType: context.routeType });
};
