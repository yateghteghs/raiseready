"use client";

import { ErrorPanel } from "@/components/app/error-panel";

/** Keeps the header and navigation on screen when a page fails. */
export default function Error(props: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorPanel {...props} />;
}
