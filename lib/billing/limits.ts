/** An action blocked by the founder's plan. The message is safe to show. */
export class PlanLimitError extends Error {
  readonly upgradeHref = "/app/billing";
}
