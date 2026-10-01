/** Feedback that hasn't arrived after this long is offered for retry. */
export const FEEDBACK_RETRY_AFTER_MS = 3 * 60 * 1000;

export function feedbackOverdue(endedAt: string | null, now: number = Date.now()): boolean {
  return endedAt !== null && now - new Date(endedAt).getTime() > FEEDBACK_RETRY_AFTER_MS;
}
