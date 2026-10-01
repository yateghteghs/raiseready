import { after } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { isSameOrigin } from "@/lib/security/same-origin";
import { finalizeSimulation, MAX_ANSWER_CHARS, SimulationError, takeTurn, type RoomEvent } from "@/lib/simulation/service";

/** A turn can include a retry; the final evaluation runs after the response. */
export const maxDuration = 300;

const bodySchema = z.object({
  answer: z.string().min(1).max(MAX_ANSWER_CHARS),
  clarifiesRedFlagId: z.uuid().nullable().optional(),
});

/** Takes the founder's answer and streams the investor's reply as newline-delimited JSON events. */
export async function POST(request: Request, ctx: RouteContext<"/api/simulations/[id]/turn">) {
  if (!isSameOrigin(request)) return new Response("Forbidden", { status: 403 });
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await ctx.params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid answer." }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: RoomEvent) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // The browser went away; keep going so the turn is still saved.
        }
      };
      try {
        const ended = await takeTurn(
          user.id,
          id,
          { answer: parsed.data.answer, clarifiesRedFlagId: parsed.data.clarifiesRedFlagId ?? null },
          emit,
        );
        if (ended) after(() => finalizeSimulation(user.id, id));
      } catch (error) {
        if (!(error instanceof SimulationError)) console.error("[simulation] turn failed:", error);
        emit({
          type: "error",
          message: error instanceof SimulationError ? error.message : "Something went wrong. Please send your answer again.",
        });
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
